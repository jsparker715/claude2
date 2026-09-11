/**
 * Confirmed business rules (from the practice), plus the two things still to
 * finalize. Per-BCBA monthly required hours come from the requirements sheet and
 * are passed in per config, not here.
 *
 * CONFIRMED:
 *   - Supervision ratio band: 10%–20% (97155:97153)
 *   - Caregiver-training (97156): 3 hours required per quarter
 *   - Telehealth cap: 50%, with a per-client override (exempt clients excluded
 *     from the cap — see EngineInput.telehealthOverrideClients)
 *   - Bonus: $40/hr over requirement, plus $20/hr for 97156 above 3 hrs/quarter
 *     when the billable minimum is met
 *   - Rollover: 50% of a quarter's deficit carries to the next quarter
 *
 * STILL TO CONFIRM:
 *   - The exact value in `session_location_type` that means telehealth
 *     (see telehealth.ts — TELEHEALTH_LOCATION_VALUES).
 *   - Which clients carry the telehealth override (data, supplied per run).
 */
import { ComplianceTargets, EngineOptions, BonusConfig } from "./types";

export const TARGETS: ComplianceTargets = {
  minSupervisionRatio: 0.1, // 10%
  maxSupervisionRatio: 0.2, // 20%
  caregiverTrainingHoursPerQuarter: 3,
  maxTelehealthShare: 0.5, // 50% (per-client overrides exempt specific clients)
};

export const BONUS: BonusConfig = {
  ratePerHourOverRequirement: 40,
  caregiverExcessRate: 20,
  caregiverBonusBaseHours: 3,
  caregiverBonusRequiresBillableMet: true,
};

export const DEFAULT_OPTIONS: Required<Omit<EngineOptions, "bonus">> & { bonus: BonusConfig } = {
  supervisionBasis: "caseload",
  telehealthBasis: "personallyDelivered",
  rolloverFraction: 0.5,
  rolloverCapHours: Infinity,
  bonus: BONUS,
};

// Back-compat aliases (older imports / tests).
export const PLACEHOLDER_TARGETS = TARGETS;
export const PLACEHOLDER_BONUS = BONUS;
