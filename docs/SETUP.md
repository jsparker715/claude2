# Getting this working — in plain language

There are two parts: a **one-time setup** (about an hour, done once), and the
**monthly routine** (a couple of minutes, forever after). You do not need to
know any code. Where a step is technical, hand this document to whoever manages
your Microsoft 365 / SharePoint — they'll recognize every step.

Think of it like this:

- A **locked filing cabinet** (a SharePoint folder only you can open) where you
  drop the two files each month.
- A **robot** (an automated flow) that reads those files, does all the math, and
  fills out **one private page per BCBA**.
- A **dashboard** (the web part) each BCBA opens to see only their own page.

---

## Part A — One-time setup

### 1. Put the app into SharePoint
You were given a file named **`bcba-compliance-webpart.sppkg`**. This is the
dashboard app.

1. Go to your **SharePoint Admin Center → More features → Apps → App Catalog**
   (or your existing "Apps for SharePoint" library).
2. **Upload** the `.sppkg` file there. When it asks, check **"Make this solution
   available to all sites"** and click **Deploy**.

(If you don't have an App Catalog yet, your SharePoint admin creates one once —
it's a standard step, a few clicks.)

### 2. Create the filing cabinet and the report pages
On the SharePoint site where the BCBAs will look:

1. Create a document library called **`Billing Inputs`** — this is where you'll
   drop the monthly files. Set its permissions so **only you (and admins) can
   open it**. BCBAs get nothing here.
2. Create a list called **`BCBA Reports`** — this holds each BCBA's private page.
3. Set up the columns and the per-person locking exactly as described in
   **`spfx/sharepoint-setup/`**. This is the part that makes it *impossible* for
   one BCBA to see another's numbers, so it's worth having your admin follow it
   precisely. It also includes a short **test** to prove the locking works before
   you trust it.

### 3. Fill in the settings spreadsheet
Make a spreadsheet called **`BCBA Config.xlsx`** and put it in `Billing Inputs`.
It lists your BCBAs, their emails, their monthly hour requirements, which clients
belong to whom, and which clients are approved for unlimited telehealth. The
exact tabs and columns are in **`flow/config-workbook.md`** (copy the layout —
it's just typing names and numbers). You only update this when staff or caseloads
change, not every month.

### 4. Add the "robot" (the automated flow)
This is what replaces your manual spreadsheet-and-email marathon.

1. Open **`BCBA Config.xlsx`** in Excel in the browser → **Automate → New Script**,
   and paste in the script from **`flow/officescript/BcbaComputeReports.osts`**.
   Name it **BCBA – Compute Reports** and save. (This is the "calculator.")
2. In **Power Automate**, build the flow described step-by-step in
   **`flow/README.md`**. It reads your two monthly files, runs the calculator, and
   fills in each BCBA's private page. Every action and setting is spelled out.

### 5. Put the dashboard on a page
On the site, edit a page (or make a new one), click **+**, and add the
**BCBA Compliance** web part. Save and publish. That's the page BCBAs bookmark.

### 6. (Admin) Add your overview page
The package also includes **BCBA Compliance — Overview (admin)** — a roll-up
table of every BCBA for a chosen period, with click-through to each person's full
detail, a "needs attention" filter, and team totals.

1. Create a **separate page** (e.g. "Compliance — Admin") and add the
   **BCBA Compliance — Overview (admin)** web part to it.
2. **Restrict that page/site to admins.** The overview shows everyone, so only you
   and your clinical managers should be able to open it. (Even if a BCBA did open
   it, SharePoint's per-row locking means they'd only see their own line — but
   keep the page admin-only so it isn't in their way.)
3. Do **not** put the overview web part on the page BCBAs use.

---

## Part B — Every month (the whole routine)

1. Export your **billing/sessions** report and save it into `Billing Inputs` as
   **`sessions.csv`**.
2. Export your **PTO** report and save it there as **`pto.csv`**.
3. **Run the flow** (one click — or let it run on a schedule).

Done. Every BCBA's dashboard updates automatically. No spreadsheets to build, no
emails to send. If you turned on the optional email step, each BCBA even gets a
"your numbers are updated" note.

---

## If you ever need the app file again (or after a change)

The `.sppkg` is built automatically in the cloud. In the GitHub repository, open
the **Actions** tab, run **"Build SharePoint package (.sppkg)"**, and download the
**bcba-compliance-sppkg** file from the finished run. Upload that to the App
Catalog (Part A step 1) to update the app. You never need to install anything on
your own computer.

---

## What each folder in the project is (for reference)

- **`spfx/`** — the dashboard app (and `spfx/sharepoint-setup/` = the security
  steps).
- **`flow/`** — the monthly robot: the calculator script and the flow guide.
- **`src/engine/`** — the tested math behind every number.
- **`prototype/`** — the clickable preview you already looked at.
- **`docs/ARCHITECTURE.md`** — the "how and why" for a technical reader.

---

## The one thing to double-check yourself

The privacy guarantee lives in the SharePoint permission steps (Part A step 2),
not in the dashboard. Before you tell BCBAs to use it, run the short **isolation
test** in `spfx/sharepoint-setup/` with a test account — sign in as one BCBA and
confirm you cannot pull up anyone else's numbers. Once that passes, you're safe
to roll it out.
