# BCBA Compliance — SharePoint web part (SPFx)

The production viewer. It reads the signed-in BCBA's precomputed `BcbaReport`
from the `BCBA Reports` list and renders their dashboard — supervision ratio,
telehealth %, caregiver training, billable vs. target, quarterly bonus, weekly
breakdown, deficit rollover, and a private notes field they can save.

**It computes nothing and it enforces nothing.** The numbers come from the engine
(run monthly by Power Automate); the isolation comes from SharePoint item-level
permissions. See [`sharepoint-setup/`](./sharepoint-setup/README.md) — that setup
is what makes a peer's data unreachable, not this code.

## Why it's a thin viewer

A SPFx web part runs in the user's browser under their own identity, so it can
never be the security boundary. This one deliberately:

- reads only the current user's row (and can only read that row, because the list
  grants each BCBA access to their item alone);
- never touches the raw billing/PTO files (BCBAs have no access to those);
- writes notes only back to the user's own item.

## Requirements

- **Node 18.17.1+ or 20.x** (SPFx 1.20 toolchain — not Node 22; use `nvm`).
- Gulp CLI is invoked via the local `gulp` dev dependency.
- A SharePoint Online tenant with an App Catalog.

## Develop

```bash
cd spfx
npm install

# Point the workbench at a real site so SP APIs resolve:
#   edit config/serve.json -> initialPage
npm run serve      # hosted workbench; renders with bundled SAMPLE data if the
                   # BCBA Reports list isn't present yet
```

The web part shows **sample data** (three example BCBAs, from the engine) whenever
no report row exists for the signed-in user — so it renders immediately in the
workbench. A visible banner marks it as sample. Turn off *Show sample data when no
report is found* in the property pane for production.

## Package & deploy

```bash
npm run package    # gulp bundle --ship && gulp package-solution --ship
# -> sharepoint/solution/bcba-compliance-webpart.sppkg
```

Upload the `.sppkg` to your tenant App Catalog, deploy, add the app to the site,
then add the **BCBA Compliance** web part to a page. Full steps and the required
list/permission setup: [`sharepoint-setup/`](./sharepoint-setup/README.md).

## Keeping in sync with the engine

The report types (`models/report.ts`) mirror `src/engine/results.ts`, and the
bundled sample (`models/sampleData.ts`) comes from the engine's output. After
changing the engine:

```bash
# in repo root:
npm run build && node prototype/generate-sample.js
# in spfx/:
npm run sync-engine-types    # refreshes models/sampleData.ts
# then reconcile models/report.ts by hand if the shape changed
```

## Structure

```
src/webparts/bcbaCompliance/
  BcbaComplianceWebPart.ts          web part shell (theme, property pane, render)
  BcbaComplianceWebPart.manifest.json
  components/
    BcbaCompliance.tsx              container: loads data, holds UI state
    parts.tsx                       KPI tiles, gates, bonus, rollover, chart, table
    BcbaCompliance.module.scss      self-contained light/dark theme tokens
    format.ts                       number/percent/money formatting
    IBcbaComplianceProps.ts
  services/ReportService.ts         SharePoint REST read + notes write
  models/report.ts                  BcbaReport types (mirror of engine results)
  models/sampleData.ts              bundled example data (generated)
  loc/                              localized strings
```

## Not runnable in this repo's cloud session

This project targets the SPFx toolchain (specific Node + gulp) and a SharePoint
tenant, so it isn't built/served here. The TypeScript has been typechecked against
SPFx-shaped stubs; build and serve it in your own environment per the steps above.
```
