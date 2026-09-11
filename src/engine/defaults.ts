/**
 * ============================================================================
 *  PLACEHOLDER BUSINESS RULES — REPLACE BEFORE GOING LIVE
 * ============================================================================
 * Every value below is a guess used only so the engine and prototype run with
 * realistic-looking numbers. None of these are real clinical/billing policy.
 * Confirm each with the practice's actual requirements, then set them in the
 * per-BCBA config (targets) and engine options that the monthly job passes in.
 *
 * TODO(you): confirm and replace —
 *   - minSupervisionRatio / maxSupervisionRatio (the 97155:97153 policy band)
 *   - caregiverTrainingHoursPerQuarter (required 97156 hours)
 *   - maxTelehealthshare (the telehealth cap)
 *   - bonus: ratePerHourOverTarget, gates, flatOnAllTargetsMet
 *   - rolloverFraction (confirmed 0.5) / rolloverCapHours
 */
import { ComplianceTargets, EngineOptions, BonusConfig } from "./types";

export const PLACEHOLDER_TARGETS: ComplianceTargets = {
  minSupervisionRatio: 0.1, // 10% supervision-to-direct — PLACEHOLDER
  maxSupervisionRatio: Infinity, // no upper cap by default — PLACEHOLDER
  caregiverTrainingHoursPerQuarter: 6, // PLACEHOLDER
  maxTelehealthShare: 0.4, // 40% cap — PLACEHOLDER
};

export const PLACEHOLDER_BONUS: BonusConfig = {
  ratePerHourOverTarget: 25, // $/hr over the (rollover-adjusted) requirement — PLACEHOLDER
  requireSupervisionRatioMet: true,
  requireCaregiverTrainingMet: true,
  requireTelehealthWithinCap: true,
  flatOnAllTargetsMet: 0, // PLACEHOLDER
};

export const DEFAULT_OPTIONS: Required<Omit<EngineOptions, "bonus">> & { bonus: BonusConfig } = {
  supervisionBasis: "caseload",
  telehealthBasis: "personallyDelivered",
  rolloverFraction: 0.5, // confirmed with you
  rolloverCapHours: Infinity,
  bonus: PLACEHOLDER_BONUS,
};
