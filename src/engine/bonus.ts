/**
 * Bonus calculation. The FORMULA here is a placeholder (see defaults.ts) — the
 * real rule is a business decision. The shape, though, is what matters for the
 * UI: a bonus is only `eligible` when every required compliance gate passes, and
 * the `breakdown` explains the dollar amount line-by-line so a BCBA can see
 * exactly why they got what they got.
 *
 * Placeholder formula (per quarter):
 *   if all required gates pass:
 *     amount = max(0, billableHours - effectiveRequiredHours) * ratePerHourOverTarget
 *            + (billableHours >= effectiveRequiredHours ? flatOnAllTargetsMet : 0)
 *   else:
 *     amount = 0, and blockedBy lists the failing gates.
 */
import { BonusConfig } from "./types";
import { BonusResult, BonusLine, ComplianceCheck } from "./results";

export interface BonusInputs {
  billableHours: number;
  effectiveRequiredHours: number | null;
  supervision: ComplianceCheck;
  telehealth: ComplianceCheck;
  caregiverTraining: ComplianceCheck;
}

export function zeroBonus(): BonusResult {
  return { eligible: false, hoursOverTarget: 0, amount: 0, breakdown: [], blockedBy: [] };
}

export function computeBonus(inp: BonusInputs, cfg: BonusConfig): BonusResult {
  const blockedBy: string[] = [];
  if (cfg.requireSupervisionRatioMet && !inp.supervision.met) blockedBy.push("Supervision ratio");
  if (cfg.requireCaregiverTrainingMet && !inp.caregiverTraining.met) blockedBy.push("Caregiver training");
  if (cfg.requireTelehealthWithinCap && !inp.telehealth.met) blockedBy.push("Telehealth cap");

  const required = inp.effectiveRequiredHours;
  const hoursOverTarget = required === null ? 0 : Math.max(0, inp.billableHours - required);
  const hoursTargetMet = required !== null && inp.billableHours >= required - 1e-9;

  const eligible = blockedBy.length === 0;
  if (!eligible) {
    return { eligible: false, hoursOverTarget, amount: 0, breakdown: [], blockedBy };
  }

  const breakdown: BonusLine[] = [];
  let amount = 0;

  if (hoursOverTarget > 0 && cfg.ratePerHourOverTarget > 0) {
    const line = hoursOverTarget * cfg.ratePerHourOverTarget;
    amount += line;
    breakdown.push({
      label: "Hours over target",
      detail: `${hoursOverTarget.toFixed(1)} hrs × $${cfg.ratePerHourOverTarget.toFixed(2)}/hr`,
      amount: line,
    });
  }

  if (hoursTargetMet && cfg.flatOnAllTargetsMet > 0) {
    amount += cfg.flatOnAllTargetsMet;
    breakdown.push({
      label: "All targets met",
      detail: "Flat bonus for meeting hours + all compliance gates",
      amount: cfg.flatOnAllTargetsMet,
    });
  }

  return { eligible: true, hoursOverTarget, amount, breakdown, blockedBy: [] };
}
