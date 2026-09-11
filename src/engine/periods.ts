/**
 * Period detection. Given the dated sessions, produce the ordered list of
 * reporting periods, exactly like the passage-billing-report skill:
 *   1. one per distinct month present (chronological)
 *   2. one per distinct quarter those months fall into
 *   3. if >1 year present, one YTD per year
 *   4. a final "ALL" period covering everything
 *
 * Each period carries a membership test over "YYYY-MM" month keys so the metric
 * code can filter sessions to the period without re-parsing dates.
 */
import { SessionRow } from "./types";
import { parseISODate, monthKey, quarterKey, monthsInQuarter } from "./dateutil";

export interface PeriodDef {
  key: string;
  kind: "month" | "quarter" | "ytd" | "all";
  label: string;
  /** Returns true if a session's month key belongs to this period. */
  includesMonth: (mKey: string) => boolean;
  /** The set of month keys this period covers (empty for "all", which takes everything). */
  months: string[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(mKey: string): string {
  const [y, m] = mKey.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function detectPeriods(sessions: SessionRow[]): PeriodDef[] {
  const monthsPresent = new Set<string>();
  const yearsPresent = new Set<number>();
  for (const s of sessions) {
    const d = parseISODate(s.date);
    if (!d) continue;
    monthsPresent.add(monthKey(d));
    yearsPresent.add(d.year);
  }

  const sortedMonths = Array.from(monthsPresent).sort();
  const quartersPresent = new Set<string>();
  for (const mKey of sortedMonths) {
    const d = parseISODate(`${mKey}-01`)!;
    quartersPresent.add(quarterKey(d));
  }
  const sortedQuarters = Array.from(quartersPresent).sort();

  const periods: PeriodDef[] = [];

  for (const mKey of sortedMonths) {
    periods.push({
      key: mKey,
      kind: "month",
      label: monthLabel(mKey),
      months: [mKey],
      includesMonth: (k) => k === mKey,
    });
  }

  for (const qKey of sortedQuarters) {
    const months = monthsInQuarter(qKey);
    const set = new Set(months);
    periods.push({
      key: qKey,
      kind: "quarter",
      label: qKey,
      months,
      includesMonth: (k) => set.has(k),
    });
  }

  if (yearsPresent.size > 1) {
    for (const year of Array.from(yearsPresent).sort()) {
      const prefix = `${year}-`;
      periods.push({
        key: `${year}-YTD`,
        kind: "ytd",
        label: `${year} YTD`,
        months: sortedMonths.filter((m) => m.startsWith(prefix)),
        includesMonth: (k) => k.startsWith(prefix),
      });
    }
  }

  periods.push({
    key: "ALL",
    kind: "all",
    label: "Total",
    months: sortedMonths.slice(),
    includesMonth: () => true,
  });

  return periods;
}
