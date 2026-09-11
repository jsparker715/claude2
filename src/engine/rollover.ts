/**
 * Quarterly deficit rollover.
 *
 * Confirmed rule: when a quarter ends below its billable-hours requirement,
 * `rolloverFraction` (default 0.5) of that deficit is ADDED to the next
 * quarter's target. The rest is forgiven.
 *
 * Details:
 *  - Deficits are measured against the *effective* requirement (base + anything
 *    already rolled in), so a carried deficit that is missed again compounds.
 *  - A deficit only rolls into the immediately following CALENDAR quarter, and
 *    only if that quarter is present in the data (a gap drops the carry).
 *  - `rolloverCapHours` caps how much can roll into any one quarter.
 */
import { nextQuarterKey } from "./dateutil";

export interface QuarterInput {
  quarterKey: string; // "YYYY-Qn"
  baseRequired: number | null;
  billable: number;
}

export interface QuarterRollover {
  quarterKey: string;
  rolledIn: number;
  effectiveRequired: number | null;
  variance: number | null;
  rollingOut: number;
}

export function computeRollover(
  quarters: QuarterInput[],
  rolloverFraction = 0.5,
  rolloverCapHours = Infinity
): Map<string, QuarterRollover> {
  const ordered = quarters.slice().sort((a, b) => a.quarterKey.localeCompare(b.quarterKey));
  const present = new Set(ordered.map((q) => q.quarterKey));
  const out = new Map<string, QuarterRollover>();
  const rollingOutByQuarter = new Map<string, number>();

  for (const q of ordered) {
    // What rolled in comes from the immediately preceding calendar quarter, if present.
    let rolledIn = 0;
    for (const [prevKey, amt] of rollingOutByQuarter) {
      if (nextQuarterKey(prevKey) === q.quarterKey) rolledIn += amt;
    }
    rolledIn = Math.min(rolledIn, rolloverCapHours);

    let effectiveRequired: number | null = null;
    let variance: number | null = null;
    let rollingOut = 0;

    if (q.baseRequired !== null) {
      effectiveRequired = q.baseRequired + rolledIn;
      variance = q.billable - effectiveRequired;
      const deficit = Math.max(0, effectiveRequired - q.billable);
      // Only carry forward if the next calendar quarter is present in the data.
      const nq = nextQuarterKey(q.quarterKey);
      if (nq && present.has(nq)) {
        rollingOut = deficit * rolloverFraction;
      }
    }

    rollingOutByQuarter.set(q.quarterKey, rollingOut);
    out.set(q.quarterKey, {
      quarterKey: q.quarterKey,
      rolledIn,
      effectiveRequired,
      variance,
      rollingOut,
    });
  }

  return out;
}
