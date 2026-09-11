# BCBA Compliance Portal — Architecture

A SharePoint-hosted portal that replaces the monthly "update 20+ billing
spreadsheets and email each BCBA" process. Each BCBA sees **only their own**
supervision ratio, caregiver-training hours, telehealth %, billable hours vs.
requirement, bonus, week-by-week breakdown, and a private notes field. The admin
only uploads two files a month (PTO + billing); everything else is computed and
distributed automatically.

---

## 1. The hard requirement: "permissions impossible to get around"

> **A SharePoint web part (SPFx) runs in the BCBA's own browser under the BCBA's
> own login. It has no server of its own.** Anything that account is *allowed to
> read* through the SharePoint / Microsoft Graph REST API, the BCBA can read
> directly — bypassing the web part completely. Hiding peers' rows in the UI is
> cosmetic, not security.

Therefore security **must** live in the storage layer, not the UI. This design
uses SharePoint's own per-item permission isolation (no Azure required), which is
airtight for a group this size.

### Chosen model: per-BCBA permission-isolated items (SharePoint + Power Automate only)

- Raw inputs (PTO, billing CSV, pairings, requirements) live in an **admin-only**
  library that BCBAs have **zero** access to.
- A monthly automated job computes **one self-contained report object per BCBA**.
- Each report is written to its **own list item / file whose permission
  inheritance is broken**, granting read to exactly one BCBA (plus the admin).
- The web part reads "the current user's report" — and because the BCBA has no
  permission to anyone else's item, there is nothing to leak even via the raw API.

Why this is safe at ~20 BCBAs: SharePoint recommends staying under ~5,000 unique
permission scopes per list. One item per BCBA per period is well within that even
over years of history.

---

## 2. Components

```
                    ADMIN-ONLY (BCBAs have no access)
  ┌───────────────────────────────────────────────────────────┐
  │  "Billing Inputs" document library                          │
  │    • sessions CSV (billing)     • PTO CSV                    │
  │    • Pairings.xlsx              • Requirements sheet         │
  └───────────────────────────┬─────────────────────────────────┘
                              │  (admin uploads monthly)
                              ▼
  ┌───────────────────────────────────────────────────────────┐
  │  Power Automate flow  "Recompute BCBA reports"              │
  │    trigger: file created/modified in Billing Inputs         │
  │    step: run Office Script (the compiled engine)            │
  │    step: for each BCBA report ->                            │
  │           upsert item in "BCBA Reports" list                │
  │           + set unique permissions (read: that BCBA)        │
  └───────────────────────────┬─────────────────────────────────┘
                              ▼
  ┌───────────────────────────────────────────────────────────┐
  │  "BCBA Reports" list — one item per BCBA, broken            │
  │  inheritance, read granted to that BCBA only                │
  │    JSON column: the BcbaReport object (this repo's engine)  │
  └───────────────────────────┬─────────────────────────────────┘
                              ▼
  ┌───────────────────────────────────────────────────────────┐
  │  SPFx web part on the BCBA's SharePoint page                │
  │    • reads ONLY the current user's item (can't see others)  │
  │    • renders periods, weekly, ratios, telehealth, bonus     │
  │    • notes field writes back to that same secured item      │
  └───────────────────────────────────────────────────────────┘
```

The **calculation engine in this repo** (`src/engine`) is the single source of
truth for every number. It is written as pure TypeScript so the *same code* runs
in three places:

1. **Unit tests** here (`npm test`) — proves the math.
2. **The Office Script** the Power Automate flow runs monthly — produces the
   reports. (Office Scripts are TypeScript; the engine is bundled into one script
   file — see `docs/DEPLOYMENT.md`.)
3. **The SPFx web part** — can re-run or validate client-side against the same
   logic if ever needed, but normally just renders the stored result.

---

## 3. SharePoint schema

### Library: `Billing Inputs` (admin-only)
Standard document library. Break inheritance at the library level: grant the
admin (and a service/owner account) Full Control; grant BCBAs nothing.

### List: `BCBA Reports`
One item per BCBA. Suggested columns:

| Column | Type | Notes |
|---|---|---|
| `Title` | Single line | BCBA display name |
| `UserEmail` | Single line | join key; matches the signed-in user |
| `PersonLookup` | Person | the BCBA's account — used to grant item read |
| `ReportJson` | Multiline (plain) | the serialized `BcbaReport` object |
| `Notes` | Multiline | BCBA's private notes (written by the web part) |
| `GeneratedAt` | DateTime | set by the flow |

Break role inheritance **per item**: remove all, add the `PersonLookup` user as
Read (Notes editable — see §6), add admin as Full Control.

### Optional list: `BCBA Config`
Holds each BCBA's targets and monthly requirements so the admin can edit business
rules without touching code. The flow reads this into the engine's `BcbaConfig`.

---

## 4. Monthly data flow (what the admin actually does)

1. Admin uploads the month's **billing/sessions CSV** and **PTO CSV** to
   `Billing Inputs` (pairings + requirements change rarely and live there too).
2. The Power Automate flow fires, runs the Office Script engine, and writes/updates
   one permission-isolated item per BCBA.
3. Each BCBA opens the page and sees their up-to-date numbers. (Optional: the flow
   also sends the "your report is updated" email — replacing today's manual send.)

That's the whole admin workload: **upload two files.**

---

## 5. How the engine maps to the old skill

The engine reproduces the `passage-billing-report` skill's math and adds the new
requirements:

| Concept | Skill today | Engine |
|---|---|---|
| Supervision ratio | 97155:97153 per client | `metrics.ts` (per-client + caseload aggregate) |
| Caregiver training | 97156 hours + "did they deliver" flag | `metrics.ts` + `compliance.ts` |
| Billable hours / required / variance | Summary tab | `PeriodReport` |
| PTO | 8h/day distribution | `pto.ts` |
| Periods (month/quarter/YTD/total) | auto-detected | `periods.ts` |
| Telehealth % | *not present* | `compliance.ts` (needs the telehealth column — see §7) |
| Week-by-week | *not present* | `weekly.ts` |
| Bonus | *not present* | `bonus.ts` (placeholder formula) |
| Quarter deficit rollover (50%) | *not present* | `rollover.ts` |
| Notes | *not present* | stored on the report item, written by the web part |

---

## 6. Notes write-back (still secure)

The BCBA's notes are stored in the `Notes` column of *their own* item. Grant the
BCBA **Contribute limited to their item** (they already have read on it; item-level
edit lets them save notes). They still cannot see or edit any other item. The web
part writes notes via the SharePoint REST API as the signed-in user; the item
permissions do the enforcing.

If even item-edit is undesirable, put notes in a separate per-BCBA item so a
recompute of the report never risks clobbering notes.

---

## 7. Business rules (confirmed)

These live in `src/engine/defaults.ts` (`TARGETS`, `BONUS`) and per-BCBA config,
not in engine logic:

- **Supervision ratio band**: 10%–20% (97155:97153).
- **Caregiver training (97156)**: 3 hours required per quarter.
- **Telehealth**: read from the `session_location_type` column; cap 50%, with a
  **per-client override** — approved clients are excluded from the cap
  (`EngineInput.telehealthOverrideClients`, applied by `telehealthShare`).
- **Bonus**: `$40/hr` over the (rollover-adjusted) requirement, **plus** `$20/hr`
  for 97156 hours above 3/quarter, the second part only when the billable minimum
  is met. Not gated by supervision-ratio or telehealth compliance.
- **Rollover**: 50% of a quarter's deficit is added to the next quarter's target
  (`rolloverFraction = 0.5`); optional `rolloverCapHours`.

### Still to finalize

- **The exact `session_location_type` value(s)** that mean telehealth. The
  resolver (`telehealth.ts`, `TELEHEALTH_LOCATION_VALUES`) currently matches
  common spellings (`telehealth`, `virtual`, `remote`, …); confirm the real
  string and set it there.
- **Which clients carry the telehealth override** — supplied as data per run
  (a SharePoint list/column), not hardcoded.
