/**
 * Name normalization — identical rules to the passage-billing-report skill:
 * strip ends, collapse internal whitespace to a single space, compare
 * case-sensitively (Passage exports preserve case correctly). We deliberately do
 * NOT fuzzy-match here; reconciliation of nicknames is an explicit overrides map,
 * exactly as the skill handles PTO names.
 */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).trim().replace(/\s+/g, " ");
}

/** Apply an overrides map (e.g. PTO nickname -> canonical BCBA name) then normalize. */
export function canonicalName(s: string, overrides?: Record<string, string>): string {
  const n = normalizeName(s);
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, n)) {
    return normalizeName(overrides[n]);
  }
  return n;
}
