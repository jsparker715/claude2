# Monthly recompute — Office Script + Power Automate flow

This is the automation that turns your two monthly uploads into one
permission-isolated report per BCBA. No Azure — it's an **Office Script** (the
bundled engine) invoked by a **Power Automate** flow that writes the results to
the `BCBA Reports` list and locks each row to its BCBA.

```
 Admin uploads sessions.csv + pto.csv to "Billing Inputs" (admin-only)
        │
        ▼
 Power Automate flow (manual button or monthly schedule)
   1. read sessions.csv + pto.csv as text
   2. Run script "BCBA – Compute Reports" against BCBA Config.xlsx
        → returns one {name,email,reportJson} per BCBA
   3. for each report: upsert item in "BCBA Reports"
        → on create: break inheritance + grant that BCBA Contribute (their row only)
   4. (optional) email each BCBA "your report is updated"
        │
        ▼
 SPFx web part shows each BCBA only their own row
```

Prerequisite: the lists/library and permission model in
[`../spfx/sharepoint-setup/`](../spfx/sharepoint-setup/README.md), and the
[`config-workbook.md`](./config-workbook.md) in Billing Inputs.

---

## Step 1 — Add the Office Script

The script is generated from the tested engine — **do not hand-edit**. Rebuild
after any engine change with `node flow/build-officescript.js`.

1. Open **`BCBA Config.xlsx`** in Excel on the web.
2. **Automate → New Script**.
3. Delete the template and paste the entire contents of
   [`officescript/BcbaComputeReports.osts`](./officescript/BcbaComputeReports.osts).
4. Rename the script **`BCBA – Compute Reports`** and **Save**.

The script's `main(workbook, sessionsCsv, ptoCsv)` reads the config sheets from
the workbook it runs against and takes the two CSVs as text parameters.

---

## Step 2 — Build the flow

Create a flow with either trigger:
- **Instant → manually trigger** (a "Run BCBA compute" button), or
- **Scheduled → Recurrence** (e.g. the 1st of each month).

Use whichever you prefer; the body is the same. Below, action names are what you
type; expressions go in the expression editor.

### 2.1 Read the two CSVs as text

Add **SharePoint → Get file content using path** twice:

| Action | Site Address | File Path |
|---|---|---|
| `Get_sessions` | your site | `/Billing Inputs/sessions.csv` |
| `Get_pto` | your site | `/Billing Inputs/pto.csv` |

Then two **Compose** actions to turn the file bytes into a string:

- `sessionsText` = `base64ToString(outputs('Get_sessions')?['body']?['$content'])`
- `ptoText`      = `base64ToString(outputs('Get_pto')?['body']?['$content'])`

> If your connector returns already-decoded text, use the file-content dynamic
> value directly instead of `base64ToString(...)`. Test once and keep whichever
> yields readable CSV.

### 2.2 Run the Office Script

Add **Excel Online (Business) → Run script**:

| Field | Value |
|---|---|
| Location | SharePoint Site |
| Document Library | Billing Inputs |
| File | `BCBA Config.xlsx` |
| Script | `BCBA – Compute Reports` |
| sessionsCsv | `outputs('sessionsText')` |
| ptoCsv | `outputs('ptoText')` |

The action returns `result` with `generatedAt`, `count`, `reports[]`, and
`warnings[]`. Optionally add a **Condition** that posts `warnings` to you if it's
non-empty.

### 2.3 Loop the reports and upsert

Add **Apply to each** over:
`body('Run_script')?['result']?['reports']`

Inside the loop, `items('Apply_to_each')` has `name`, `email`, `reportJson`.

Use the **native SharePoint actions** for the list read/write — they escape the
`reportJson` string for you and give a person-field picker — and **Send an HTTP
request to SharePoint** only for the two permission calls. This avoids all manual
JSON escaping.

**(a) Find an existing row** — SharePoint **Get items** (`Get_existing`):
- List: `BCBA Reports`
- Filter Query: `UserEmail eq '@{items('Apply_to_each')?['email']}'`
- Top Count: `1`

**(b) Condition** — `length(body('Get_existing')?['value'])` is greater than `0`.

**If yes (update — preserves Notes):** SharePoint **Update item**
- List: `BCBA Reports`; Id: `@{first(body('Get_existing')?['value'])?['ID']}`
- `Title` = `name`, `UserEmail` = `email`, `ReportJson` = `reportJson`,
  `GeneratedAt` = `body('Run_script')?['result']?['generatedAt']`,
  `PersonLookup Claims` = `items('Apply_to_each')?['email']`
- **Leave `Notes` blank/untouched** so saved notes survive the recompute.

**If no (create + lock down):**
1. SharePoint **Create item** (`Create_item`) — same fields as the update. Its
   output gives the new `ID`.
2. **Send an HTTP request to SharePoint** — break inheritance:
   - `POST` `_api/web/lists/getbytitle('BCBA Reports')/items(@{body('Create_item')?['ID']})/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`
3. **Send an HTTP request to SharePoint** — ensure the user (`Ensure_user`):
   - `POST` `_api/web/ensureuser`
   - Headers: `Accept: application/json;odata=nometadata`, `Content-Type: application/json;odata=nometadata`
   - Body: `{ "logonName": "i:0#.f|membership|@{items('Apply_to_each')?['email']}" }`
   - Principal id = `body('Ensure_user')?['Id']`
4. **Send an HTTP request to SharePoint** — get the Contribute role id (`Get_role`):
   - `GET` `_api/web/roledefinitions/getbyname('Contribute')` → `body('Get_role')?['Id']`
5. **Send an HTTP request to SharePoint** — grant that BCBA only:
   - `POST` `_api/web/lists/getbytitle('BCBA Reports')/items(@{body('Create_item')?['ID']})/roleassignments/addroleassignment(principalid=@{body('Ensure_user')?['Id']},roledefid=@{body('Get_role')?['Id']})`

That's the whole isolation guarantee: the row is created, inheritance is broken
(no one inherits access), and only that BCBA is granted Contribute on that one
item. List owners/admins keep Full Control. (Permissions only need setting on
**create**; updates keep the scope you set the first time.)

> **Notes preservation:** the update branch never writes `Notes`, so a BCBA's saved
> notes survive every monthly recompute. Keep it that way.

> **Contribute vs Read:** Contribute lets the BCBA save their Notes on their own
> item. If you move Notes to a separate item/list, grant **Read** here instead
> (query `getbyname('Read')`).

### 2.4 (optional) Notify each BCBA

Still inside the loop, add **Office 365 Outlook → Send an email (V2)** to
`items('Apply_to_each')?['email']` with a link to the page. This replaces the
manual "email the BCBA" step.

---

## Step 3 — First run & verify

1. Upload `sessions.csv`, `pto.csv`, and `BCBA Config.xlsx` to Billing Inputs.
2. Run the flow. Check `warnings` is empty and `count` matches your BCBA count.
3. Open the `BCBA Reports` list as an admin — confirm one row per BCBA with
   `ReportJson` populated.
4. **Run the isolation checklist** in
   [`../spfx/sharepoint-setup/`](../spfx/sharepoint-setup/README.md#verify-isolation-before-you-trust-it)
   with a test BCBA account before relying on it.

---

## Keeping the script current

The `.osts` is generated from `src/engine/*`. After changing the engine:

```bash
npm run build && npm test          # engine still green
node flow/build-officescript.js    # regenerate the .osts
```

Then re-paste it into the Office Script and Save. The engine is the single
source of truth; the script, the web part, and the tests all derive from it.
