/**
 * PTO distribution — mirrors the skill: each approved request's hours are spread
 * calendar-day-by-day starting at the request's start date, `hoursPerDay` per day
 * (default 8), with any remainder on the final day. The result is hours per
 * "YYYY-MM" month key, which periods then sum.
 *
 * Only rows the host has already filtered to APPROVED should be passed in.
 */
import { PtoRow } from "./types";
import { parseISODate, toDayNumber, fromDayNumber, monthKey } from "./dateutil";

export function distributePtoByMonth(rows: PtoRow[], hoursPerDay = 8): Record<string, number> {
  const byMonth: Record<string, number> = {};
  for (const row of rows) {
    const start = parseISODate(row.startDate);
    const total = Number(row.hours);
    if (!start || !isFinite(total) || total <= 0) continue;

    let remaining = total;
    let dayNum = toDayNumber(start);
    // Guard against pathological inputs producing an unbounded loop.
    let safety = 0;
    while (remaining > 1e-9 && safety < 3660) {
      const chunk = Math.min(hoursPerDay, remaining);
      const mKey = monthKey(fromDayNumber(dayNum));
      byMonth[mKey] = (byMonth[mKey] || 0) + chunk;
      remaining -= chunk;
      dayNum += 1;
      safety += 1;
    }
  }
  return byMonth;
}

/** Sum PTO across a set of month keys (used to project onto a period). */
export function ptoForMonths(byMonth: Record<string, number>, months: string[]): number {
  let sum = 0;
  for (const m of months) sum += byMonth[m] || 0;
  return sum;
}
