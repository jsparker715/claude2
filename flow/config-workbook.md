# `BCBA Config.xlsx` — the stored config workbook

One Excel file kept in the **Billing Inputs** library (admin-only). The monthly
Office Script reads its sheets. The two things that change monthly (sessions,
PTO) are **not** here — they're uploaded as CSVs and passed to the script
separately. This file holds the things that change rarely.

Create a workbook named exactly **`BCBA Config.xlsx`** with these sheets (sheet
names must match; column headers are matched case/space-insensitively).

## Sheet: `Pairings`
Which clients each BCBA owns. One row per (BCBA, client).

| Consultant | Client Name |
|---|---|
| Dr. Sam Rivera | Client Alvarez |
| Dr. Sam Rivera | Client Brooks |
| Dr. Priya Chen | Client Cho |

(`BCBA` / `Analyst` / `Consultant Name` also accepted for the first column;
`Client` for the second.)

## Sheet: `Requirements`
One row per BCBA: identity, monthly required billable hours, and optional
target overrides. Month columns are headers in **`YYYY-MM`** form — add the
months you're reporting on.

| Consultant Name | Email | 2026-01 | 2026-02 | 2026-03 | 2026-04 | … |
|---|---|---|---|---|---|---|
| Dr. Sam Rivera | sam@brightpath.org | 40 | 40 | 40 | 40 | … |
| Dr. Priya Chen | priya@brightpath.org | 40 | 40 | 40 | 40 | … |

Optional per-BCBA override columns (omit to use the practice defaults — ratio
10–20%, 3 caregiver hrs/qtr, 50% telehealth cap):

| Min Ratio | Max Ratio | Caregiver Hrs/Qtr | Telehealth Cap |
|---|---|---|---|
| 0.10 | 0.20 | 3 | 0.50 |

`Email` must equal the BCBA's Microsoft 365 sign-in address — it's the key the
web part and the permission step use.

## Sheet: `TelehealthOverrides`
Clients approved for telehealth (excluded from the 50% cap for everyone).

| Client Name |
|---|
| Client Cho |

## Sheet: `NameOverrides` (optional)
Reconciles PTO names to BCBA names when the time-off system uses nicknames.

| From | To |
|---|---|
| Dani Hamer | Danielle Hamer |

---

## The two monthly uploads (CSV, not in this workbook)

Uploaded to Billing Inputs each month; the flow reads them as text and passes
them to the script.

**Sessions/billing CSV** — columns used: `client`, `team_member`,
`billing_code`, `session_duration`, `session_start_date`, `session_location_type`
(telehealth is derived from this: `Telehealth` or `TelehealthHome`). Save it in
Billing Inputs as **`sessions.csv`**.

**PTO CSV** — columns used: `Employee`, `Leave request duration in hours`,
`Start Date`, `Leave end date`, `Leave request status` (only `APPROVED` counts).
Save it as **`pto.csv`**.
