# BCBA Compliance Portal

Replaces the monthly "gather caseloads, pull billing + PTO, update 20+
spreadsheets, email each BCBA" process with a SharePoint portal where each BCBA
sees **only their own** compliance data, and the admin only uploads two files a
month.

## What's here now

- **`src/engine/`** — the calculation engine (pure, portable TypeScript). It
  reproduces the `passage-billing-report` skill's math and adds telehealth %,
  week-by-week breakdowns, bonus calculations, and the quarterly 50%-deficit
  rollover. Fully unit-tested (`npm test`).
- **`spfx/`** — the SharePoint (SPFx) web part: the production viewer each BCBA
  loads. Reads their own precomputed report and renders the dashboard; writes
  their notes back. Thin by design — isolation is enforced by SharePoint
  permissions, not the UI. See `spfx/README.md` and `spfx/sharepoint-setup/`.
- **`flow/`** — the monthly recompute: the engine bundled into a single **Office
  Script** (`flow/officescript/BcbaComputeReports.osts`, generated) plus a
  step-by-step **Power Automate** build guide that upserts one permission-isolated
  report per BCBA. See `flow/README.md`.
- **`prototype/`** — the clickable design prototype (published as an artifact).
- **`docs/ARCHITECTURE.md`** — the SharePoint-only, permission-isolated design
  (no Azure) that makes "BCBAs can't see peers' data" airtight, and how the
  engine plugs into Power Automate + the SPFx web part.

## Why the engine is standalone TypeScript

Because the security model is SharePoint + Power Automate only (no Azure), the
monthly computation runs as an **Office Script** (TypeScript) invoked by Power
Automate. Writing the engine as framework-agnostic pure functions lets the exact
same code power (1) these unit tests, (2) that Office Script, and (3) the SPFx web
part. One source of truth for every number.

## Develop

```bash
npm install
npm test        # compile + run the engine unit tests
npm run build   # compile to dist/
```

## Status

- [x] Calculation engine + tests
- [x] Business rules encoded (ratio 10–20%, telehealth ≤50% + per-client override, 3 caregiver hrs/qtr, 50% rollover, $40/hr + $20/hr bonus — see `docs/ARCHITECTURE.md` §7)
- [x] Interactive BCBA dashboard prototype
- [x] SPFx web part (`spfx/`) — viewer, notes write-back, sample-data fallback; typechecked (build/deploy in your tenant)
- [x] Office Script (engine bundled) + Power Automate build guide (`flow/`) — Office Script output verified identical to the engine; flow steps documented (build in your tenant)

> Two data items still to finalize (see `docs/ARCHITECTURE.md` §7): the exact
> `session_location_type` value that means telehealth, and which clients carry
> the telehealth override.
