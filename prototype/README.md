# Dashboard prototype

An interactive preview of the per-BCBA compliance view, driven by the **real
calculation engine** (`../src/engine`) running on synthetic example data. It's a
design/behavior prototype — not the production web part — so you can react to the
layout, the bonus/rollover presentation, and the per-person isolation before the
SPFx build.

Published artifact: see the link shared in the conversation.

## Rebuild it

```bash
npm run build                      # compile the engine to dist/
node prototype/generate-sample.js  # -> prototype/sample-reports.json (example BcbaReport[])
node prototype/build.js            # inject data into the template -> prototype/dashboard.html
```

Then open `prototype/dashboard.html` in a browser, or publish it as an artifact.

## Files

- `dashboard.template.html` — the page (HTML/CSS/vanilla JS), with a
  `__REPORTS_JSON__` placeholder where the data is injected. **Source of truth.**
- `generate-sample.js` — builds three example BCBAs (a bonus case, a
  deficit-rollover case, and a compliance-blocked case) and runs them through the
  engine.
- `build.js` — injects the generated JSON into the template.
- `sample-reports.json`, `dashboard.html` — generated (git-ignored).

## What the three example BCBAs demonstrate

| BCBA | Shows |
|---|---|
| Dr. Sam Rivera | Over target, all gates pass → **bonus paid** |
| Dr. Priya Chen | Q1 deficit → **50% rolls into Q2's target**; Q1 telehealth over cap |
| Dr. Marcus Bell | Hours met but ratio too low + no caregiver training → **bonus blocked** |

The **Viewing as** switcher is a prototype-only convenience to preview each
person's private view. In production, each user is locked to their own record by
SharePoint item-level permissions (see `../docs/ARCHITECTURE.md`).
