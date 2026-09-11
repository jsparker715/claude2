/**
 * Week-by-week breakdown of the BCBA's personally-delivered work, keyed by ISO
 * week. Undated sessions are skipped (they can't be placed in a week).
 */
import { SessionRow, CODE_DIRECT, CODE_SUPERVISION, CODE_CAREGIVER_TRAINING } from "./types";
import { WeeklyRow } from "./results";
import { normalizeName } from "./names";
import { parseISODate, isoWeekKey, isoWeekStart, monthKey } from "./dateutil";

export function weeklyBreakdown(sessions: SessionRow[], bcba: string): WeeklyRow[] {
  const target = normalizeName(bcba);
  const byWeek = new Map<string, WeeklyRow>();

  for (const s of sessions) {
    if (normalizeName(s.teamMember) !== target) continue;
    const d = parseISODate(s.date);
    if (!d) continue;
    const key = isoWeekKey(d);
    let row = byWeek.get(key);
    if (!row) {
      const ws = isoWeekStart(d);
      row = {
        weekKey: key,
        weekStart: monthKey(ws) + "-" + String(ws.day).padStart(2, "0"),
        billableHours: 0,
        directHours: 0,
        supervisionHours: 0,
        caregiverTrainingHours: 0,
        telehealthHours: 0,
        sessionCount: 0,
      };
      byWeek.set(key, row);
    }
    const hrs = Number(s.durationHours) || 0;
    row.billableHours += hrs;
    row.sessionCount += 1;
    if (s.billingCode === CODE_DIRECT) row.directHours += hrs;
    else if (s.billingCode === CODE_SUPERVISION) row.supervisionHours += hrs;
    else if (s.billingCode === CODE_CAREGIVER_TRAINING) row.caregiverTrainingHours += hrs;
    if (s.telehealth) row.telehealthHours += hrs;
  }

  return Array.from(byWeek.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}
