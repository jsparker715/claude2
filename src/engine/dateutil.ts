/**
 * Small, dependency-free date helpers. We parse "YYYY-MM-DD" manually rather
 * than using `new Date(str)` to avoid timezone drift (which can shift a date to
 * the previous/next day depending on the host's locale).
 */

export interface YMD {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** Parse "YYYY-MM-DD" (optionally with a trailing time). Returns null if unparseable. */
export function parseISODate(s: string | null | undefined): YMD | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** "YYYY-MM" key for a date. */
export function monthKey(d: YMD): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}`;
}

/** Calendar quarter (1-4) for a month (1-12). */
export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/** "YYYY-Qn" key for a date. */
export function quarterKey(d: YMD): string {
  return `${d.year}-Q${quarterOfMonth(d.month)}`;
}

/** The three month keys ("YYYY-MM") that make up a given "YYYY-Qn". */
export function monthsInQuarter(qKey: string): string[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(qKey);
  if (!m) return [];
  const year = Number(m[1]);
  const q = Number(m[2]);
  const first = (q - 1) * 3 + 1;
  return [first, first + 1, first + 2].map((mm) => `${year}-${String(mm).padStart(2, "0")}`);
}

/** The quarter key immediately following the given one (rolls over the year). */
export function nextQuarterKey(qKey: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(qKey);
  if (!m) return null;
  let year = Number(m[1]);
  let q = Number(m[2]) + 1;
  if (q > 4) {
    q = 1;
    year += 1;
  }
  return `${year}-Q${q}`;
}

/** Days since an epoch, for date arithmetic. Uses UTC to stay locale-independent. */
export function toDayNumber(d: YMD): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86400000);
}

/** Inverse of toDayNumber. */
export function fromDayNumber(n: number): YMD {
  const dt = new Date(n * 86400000);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/**
 * ISO-8601 week key "YYYY-Www" (weeks start Monday; week 1 contains the year's
 * first Thursday). Used for the week-by-week breakdown.
 */
export function isoWeekKey(d: YMD): string {
  const dayNum = toDayNumber(d);
  // ISO weekday: Mon=1..Sun=7
  const dow = ((new Date(dayNum * 86400000).getUTCDay() + 6) % 7) + 1;
  // Thursday of this week determines the ISO year.
  const thursday = dayNum + (4 - dow);
  const tDate = fromDayNumber(thursday);
  const isoYear = tDate.year;
  const jan1 = toDayNumber({ year: isoYear, month: 1, day: 1 });
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Monday (date) of the ISO week containing d, as YMD. Handy for labeling weeks. */
export function isoWeekStart(d: YMD): YMD {
  const dayNum = toDayNumber(d);
  const dow = ((new Date(dayNum * 86400000).getUTCDay() + 6) % 7) + 1;
  return fromDayNumber(dayNum - (dow - 1));
}
