/**
 * Bonus calculation — confirmed formula (per quarter):
 *
 *   A) $40 per billable hour delivered ABOVE the (rollover-adjusted) requirement.
 *   B) $20 per 97156 (caregiver-training) hour above 3 hours in the quarter,
 *      paid ONLY if the billable minimum requirement is met.
 *
 *   amount = A + B
 *
 * The bonus is intentionally NOT gated by supervision-ratio or telehealth
 * compliance — those are requirements tracked elsewhere, not bonus conditions.
 * The `breakdown` explains the amount line-by-line for the "easy to view" display.
 */
import { BonusConfig } from "./types";
import { BonusResult, BonusLine } from "./results";

export interface BonusInputs {
  /** Qualifying billable hours (0-requirement months already excluded). */
  billableHours: number;
  effectiveRequiredHours: number | null;
  /** Sum over families of caregiver hours above the per-family base (already computed). */
  caregiverExcessHours: number;
}

export function zeroBonus(): BonusResult {
  return { eligible: false, hoursOverTarget: 0, amount: 0, breakdown: [], blockedBy: [] };
}

export function computeBonus(inp: BonusInputs, cfg: BonusConfig): BonusResult {
  const required = inp.effectiveRequiredHours;
  const billableMet = required !== null && inp.billableHours >= required - 1e-9;
  const hoursOverTarget = required === null ? 0 : Math.max(0, inp.billableHours - required);

  const breakdown: BonusLine[] = [];
  const blockedBy: string[] = [];
  let amount = 0;

  // A) hours over requirement
  if (hoursOverTarget > 0 && cfg.ratePerHourOverRequirement > 0) {
    const line = hoursOverTarget * cfg.ratePerHourOverRequirement;
    amount += line;
    breakdown.push({
      label: "Hours over requirement",
      detail: `${hoursOverTarget.toFixed(1)} hrs × $${cfg.ratePerHourOverRequirement.toFixed(0)}/hr`,
      amount: line,
    });
  }

  // B) caregiver-training hours above the per-family base (summed), gated on the
  //    billable minimum.
  const caregiverExcess = Math.max(0, inp.caregiverExcessHours);
  if (caregiverExcess > 0 && cfg.caregiverExcessRate > 0) {
    if (!cfg.caregiverBonusRequiresBillableMet || billableMet) {
      const line = caregiverExcess * cfg.caregiverExcessRate;
      amount += line;
      breakdown.push({
        label: `Caregiver training over ${cfg.caregiverBonusBaseHours} hrs/family`,
        detail: `${caregiverExcess.toFixed(1)} hrs × $${cfg.caregiverExcessRate.toFixed(0)}/hr`,
        amount: line,
      });
    } else {
      blockedBy.push(
        `Caregiver-training bonus (${caregiverExcess.toFixed(1)} excess hrs) needs the billable requirement met first.`
      );
    }
  }

  // Eligible = the billable requirement was met (the gate that matters for this scheme).
  const eligible = billableMet;
  if (required !== null && !billableMet) {
    blockedBy.unshift(
      `Billable requirement not met (${inp.billableHours.toFixed(1)} of ${required.toFixed(1)} hrs).`
    );
  }

  return { eligible, hoursOverTarget, amount, breakdown, blockedBy };
}
