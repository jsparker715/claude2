/* =============================================================================
 * OFFICE SCRIPT GLUE — appended after the bundled engine by build-officescript.js.
 *
 * Do not add imports/exports here (Office Scripts are a single module). Every
 * engine symbol used below (SessionRow, PtoRow, Pairing, BcbaConfig, TARGETS,
 * BONUS, buildAllReports, isTelehealthLocation, …) comes from the engine code
 * concatenated ABOVE this block.
 *
 * The "Run script" action in Power Automate calls main() with:
 *   - workbook:    the stored "BCBA Config.xlsx" (tabs: Pairings, Requirements,
 *                  TelehealthOverrides, optionally NameOverrides)
 *   - sessionsCsv: raw text of the month's billing/sessions CSV
 *   - ptoCsv:      raw text of the month's PTO CSV
 *
 * It returns one entry per BCBA. The flow then upserts each into the
 * "BCBA Reports" list and sets that BCBA's item-level permission.
 * ========================================================================== */

interface ReportOutput {
  name: string;
  email: string;
  reportJson: string;
}
interface ScriptResult {
  generatedAt: string;
  count: number;
  reports: ReportOutput[];
  warnings: string[];
}

/** Minimal, correct CSV parser: handles quoted fields, embedded commas, quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  // last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

/** Turn a parsed CSV into objects keyed by the (trimmed) header row. */
function csvToObjects(text: string): { [k: string]: string }[] {
  const rows = parseCsv(text);
  if (rows.length < 1) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: { [k: string]: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: { [k: string]: string } = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (rows[r][c] || "").trim();
    out.push(obj);
  }
  return out;
}

function toNum(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Normalize a spreadsheet date cell (which may be text or an Excel serial) to YYYY-MM-DD. */
function toIsoDate(v: string): string {
  const t = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const md = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t); // M/D/YYYY
  if (md) {
    let y = md[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${String(+md[1]).padStart(2, "0")}-${String(+md[2]).padStart(2, "0")}`;
  }
  return t; // engine tolerates unparseable dates (Total period only)
}

/** First present value among candidate header names (case/space tolerant). */
function pick(obj: { [k: string]: string }, keys: string[]): string {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  // case-insensitive fallback
  const lower: { [k: string]: string } = {};
  for (const kk of Object.keys(obj)) lower[kk.toLowerCase().replace(/\s+/g, "")] = obj[kk];
  for (const k of keys) {
    const key = k.toLowerCase().replace(/\s+/g, "");
    if (lower[key] !== undefined) return lower[key];
  }
  return "";
}

function parseSessions(csv: string): SessionRow[] {
  return csvToObjects(csv).map((o) => {
    const loc = pick(o, ["session_location_type", "location_type", "location"]);
    return {
      client: pick(o, ["client", "client_name"]),
      teamMember: pick(o, ["team_member", "staff", "provider"]),
      billingCode: pick(o, ["billing_code", "cpt", "code"]).trim(),
      durationHours: toNum(pick(o, ["session_duration", "duration", "hours"])),
      date: toIsoDate(pick(o, ["session_start_date", "date", "start_date"])),
      telehealth: isTelehealthLocation(loc),
    };
  });
}

function parsePto(csv: string): PtoRow[] {
  return csvToObjects(csv)
    .filter((o) => {
      const status = pick(o, ["Leave request status", "status"]).toUpperCase();
      return status === "" || status === "APPROVED"; // count APPROVED (or unmarked)
    })
    .map((o) => ({
      employee: pick(o, ["Employee", "employee", "name"]),
      hours: toNum(pick(o, ["Leave request duration in hours", "hours", "duration"])),
      startDate: toIsoDate(pick(o, ["Start Date", "start_date", "start"])),
      endDate: toIsoDate(pick(o, ["Leave end date", "end_date", "end"])),
    }));
}

/** Read a worksheet into header-keyed objects; returns [] if the sheet is missing. */
function sheetObjects(workbook: ExcelScript.Workbook, name: string): { [k: string]: string }[] {
  const ws = workbook.getWorksheet(name);
  if (!ws) return [];
  const used = ws.getUsedRange();
  if (!used) return [];
  const texts = used.getTexts(); // displayed strings, so dates/numbers read predictably
  if (texts.length < 1) return [];
  const headers = texts[0].map((h) => String(h).trim());
  const out: { [k: string]: string }[] = [];
  for (let r = 1; r < texts.length; r++) {
    const obj: { [k: string]: string } = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const v = String(texts[r][c] || "").trim();
      obj[headers[c]] = v;
      if (v !== "") any = true;
    }
    if (any) out.push(obj);
  }
  return out;
}

function readPairings(workbook: ExcelScript.Workbook): Pairing[] {
  return sheetObjects(workbook, "Pairings")
    .map((o) => ({
      bcba: pick(o, ["Consultant", "BCBA", "Consultant Name", "Analyst"]),
      client: pick(o, ["Client Name", "Client", "client"]),
    }))
    .filter((p) => p.bcba !== "" && p.client !== "");
}

function readOverrides(workbook: ExcelScript.Workbook): string[] {
  return sheetObjects(workbook, "TelehealthOverrides")
    .map((o) => pick(o, ["Client Name", "Client", "client"]))
    .filter((c) => c !== "");
}

function readNameOverrides(workbook: ExcelScript.Workbook): { [k: string]: string } {
  const map: { [k: string]: string } = {};
  for (const o of sheetObjects(workbook, "NameOverrides")) {
    const from = pick(o, ["From", "PTO Name", "from"]);
    const to = pick(o, ["To", "BCBA Name", "to"]);
    if (from && to) map[from] = to;
  }
  return map;
}

function readConfigs(workbook: ExcelScript.Workbook, warnings: string[]): BcbaConfig[] {
  const rows = sheetObjects(workbook, "Requirements");
  const configs: BcbaConfig[] = [];
  for (const o of rows) {
    const name = pick(o, ["Consultant Name", "Consultant", "BCBA", "Name"]);
    if (!name) continue;
    const email = pick(o, ["Email", "email"]);
    const requiredHoursByMonth: { [k: string]: number } = {};
    for (const key of Object.keys(o)) {
      if (/^\d{4}-\d{2}$/.test(key.trim())) {
        const v = o[key].trim();
        if (v !== "") requiredHoursByMonth[key.trim()] = toNum(v);
      }
    }
    // Optional per-BCBA target overrides; fall back to the practice defaults.
    const minR = pick(o, ["Min Ratio", "minSupervisionRatio"]);
    const maxR = pick(o, ["Max Ratio", "maxSupervisionRatio"]);
    const cg = pick(o, ["Caregiver Hrs/Qtr", "caregiverTrainingHoursPerQuarter"]);
    const teleCap = pick(o, ["Telehealth Cap", "maxTelehealthShare"]);
    const targets: ComplianceTargets = {
      minSupervisionRatio: minR !== "" ? toNum(minR) : TARGETS.minSupervisionRatio,
      maxSupervisionRatio: maxR !== "" ? toNum(maxR) : TARGETS.maxSupervisionRatio,
      caregiverTrainingHoursPerQuarter: cg !== "" ? toNum(cg) : TARGETS.caregiverTrainingHoursPerQuarter,
      maxTelehealthShare: teleCap !== "" ? toNum(teleCap) : TARGETS.maxTelehealthShare,
    };
    configs.push({ name, email: email || undefined, requiredHoursByMonth, targets });
  }
  if (configs.length === 0) warnings.push("Requirements sheet produced no BCBA configs — check the sheet name and 'Consultant Name' column.");
  return configs;
}

function main(workbook: ExcelScript.Workbook, sessionsCsv: string, ptoCsv: string): ScriptResult {
  const warnings: string[] = [];
  if (!sessionsCsv || sessionsCsv.trim() === "") warnings.push("sessionsCsv was empty.");

  const sessions = parseSessions(sessionsCsv || "");
  const pto = parsePto(ptoCsv || "");
  const pairings = readPairings(workbook);
  const configs = readConfigs(workbook, warnings);
  const telehealthOverrideClients = readOverrides(workbook);
  const ptoNameOverrides = readNameOverrides(workbook);

  const reports = buildAllReports({
    sessions,
    pto,
    pairings,
    configs,
    telehealthOverrideClients,
    ptoNameOverrides,
  });

  const generatedAt = new Date().toISOString();
  const out: ReportOutput[] = reports.map((r) => {
    r.generatedAt = generatedAt;
    return { name: r.bcba, email: r.email || "", reportJson: JSON.stringify(r) };
  });

  return { generatedAt, count: out.length, reports: out, warnings };
}
