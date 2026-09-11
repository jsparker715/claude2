# SharePoint setup & permissions (the part that makes peer data unreachable)

The web part is only a viewer. **All isolation is enforced here, in SharePoint.**
Follow this exactly — the security requirement ("no BCBA can see a peer's data")
depends on the permission steps, not the web part.

## Lists & libraries

### 1. `Billing Inputs` — document library (admin-only)
Where you upload the monthly files. BCBAs get **no access**.

- Create a document library named **Billing Inputs**.
- Stop inheriting permissions (Library settings → Permissions → *Stop Inheriting
  Permissions*). Remove all groups except:
  - You / the compliance admins → **Full Control** (or Edit).
  - The account the monthly flow runs as → **Edit**.
- Nobody else. No "Everyone", no members group.
- Upload here: the sessions/billing CSV, the PTO CSV, `Pairings.xlsx`, and the
  requirements sheet.

### 2. `BCBA Reports` — custom list (one row per BCBA)
Holds each BCBA's computed report. Columns:

| Column (internal name) | Type | Notes |
|---|---|---|
| `Title` | Single line | BCBA display name |
| `UserEmail` | Single line of text | join key the web part filters on; must equal the BCBA's sign-in email |
| `PersonLookup` | Person or Group | optional/informational — shows whose row it is. NOT the privacy mechanism (that's the per-item permission grant via `ensureuser` in the flow). Fine to leave empty. |
| `ReportJson` | Multiple lines (plain text) | the serialized `BcbaReport`. Make it plain text, not rich text, and large enough (it's a few KB) |
| `Notes` | Multiple lines (plain text) | the BCBA's private notes; the web part writes here |
| `GeneratedAt` | Date and Time | set by the flow |

Set the list itself to **not** grant broad read: break inheritance on the list,
remove the members/visitors groups, leave only admins + the flow account. Then the
flow adds per-item read for each BCBA (next section). Result: a BCBA has no
list-level read, and can reach exactly one item — their own.

### 3. (optional) `BCBA Config` — custom list
One row per BCBA with their monthly required hours + targets, so you can change
business rules without editing code. The flow reads it into the engine's config.
Admin-only.

## Per-item permissions (the core control)

For each BCBA's item in `BCBA Reports`, the monthly flow must:

1. **Break role inheritance** on the item
   (`roleassignments/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)`).
2. **Grant the BCBA `Contribute`** on that item only (Contribute so they can save
   Notes; if you keep Notes in a separate item, grant **Read** here instead).
3. Ensure admins/owners retain Full Control (they do, as list owners).

Because inheritance is broken and only that BCBA is granted, **no other BCBA can
read the item via the UI, the REST API, Graph, search, or any other client** —
the web part's `UserEmail` filter is convenience, not the fence.

> Scale note: this creates ~1 unique permission scope per BCBA per (kept) report
> item. SharePoint's guidance is to stay under ~5,000 unique scopes per list; at
> ~20 BCBAs you are far below that even keeping years of monthly history. If you
> ever keep one item per BCBA per month for many years, archive old items.

## Verify isolation before you trust it

Do this once, with a test account:

1. Sign in as a non-admin BCBA (or a test user granted one item).
2. In the browser, hit the REST endpoint directly:
   `https://<site>/_api/web/lists/getByTitle('BCBA Reports')/items` — confirm it
   returns **only that user's item** (or 403/empty for someone with none).
3. Try to open another BCBA's item by id:
   `.../items(<other id>)` — confirm **403 Access denied**.
4. Confirm the same user cannot open `Billing Inputs` at all.

If any of those leak, fix the permissions before go-live — the web part cannot
compensate.

## Deploy the web part

1. Build the package (see `../README.md`): `npm run package` → produces
   `sharepoint/solution/bcba-compliance-webpart.sppkg`.
2. Upload the `.sppkg` to your tenant **App Catalog** and deploy.
3. Add the app to the site, then add the **BCBA Compliance** web part to a page.
4. In the web part property pane, set the **BCBA Reports list title** if you named
   it differently, and toggle **Show sample data when no report is found** off for
   production (leave on while testing).
