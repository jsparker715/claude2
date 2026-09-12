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

/**
 * Forgiving key for matching CLIENT names between the sessions export and the
 * Pairings sheet. It absorbs the common cosmetic differences so real clients
 * match without hand-editing, while still leaving genuinely different clients
 * unmatched (so they're ignored, never mis-credited):
 *   - case-insensitive
 *   - "Last, First" reordered to "First Last"
 *   - punctuation (commas, periods, hyphens, apostrophes) dropped
 *   - internal whitespace collapsed
 * Apply to BOTH sides before comparing.
 */
export function clientKey(s: string | null | undefined): string {
  let n = normalizeName(s).toLowerCase();
  if (!n) return "";
  const comma = n.indexOf(",");
  if (comma >= 0) {
    const parts = n.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    n = parts.length === 2 ? parts[1] + " " + parts[0] : parts.join(" ");
  }
  // Drop apostrophes/periods with NO space (O'Brien -> obrien, J. -> j); turn
  // other punctuation (hyphens, slashes, remaining commas) into spaces.
  n = n.replace(/['`.’]/g, "");
  return n.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
