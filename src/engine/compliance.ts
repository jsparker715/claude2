/**
 * Turn measured values into ComplianceCheck objects the web part can render
 * directly. Ratios and shares are fractions (0.10 == 10%).
 */
import { ComplianceTargets } from "./types";
import { ComplianceCheck } from "./results";

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** Supervision ratio (97155/97153) must sit within [min, max]. null ratio = not yet measurable. */
export function supervisionRatioCheck(ratio: number | null, t: ComplianceTargets): ComplianceCheck {
  if (ratio === null) {
    return {
      value: 0,
      target: t.minSupervisionRatio,
      met: false,
      detail: "No direct (97153) hours yet — ratio not measurable.",
    };
  }
  const withinMin = ratio >= t.minSupervisionRatio;
  const withinMax = ratio <= t.maxSupervisionRatio;
  const met = withinMin && withinMax;
  let detail: string;
  if (!withinMin) detail = `Ratio ${pct(ratio)} is below the ${pct(t.minSupervisionRatio)} minimum.`;
  else if (!withinMax) detail = `Ratio ${pct(ratio)} exceeds the ${pct(t.maxSupervisionRatio)} maximum.`;
  else detail = `Ratio ${pct(ratio)} is within target.`;
  return { value: ratio, target: t.minSupervisionRatio, met, detail };
}

/**
 * Telehealth share of hours must be at or below the cap. Clients with a
 * telehealth override are excluded from the share entirely; `exemptClientCount`
 * is only used to annotate the detail line.
 */
export function telehealthCheck(
  share: number,
  t: ComplianceTargets,
  exemptClientCount = 0
): ComplianceCheck {
  const met = share <= t.maxTelehealthShare + 1e-9;
  const exemptNote =
    exemptClientCount > 0
      ? ` (${exemptClientCount} client${exemptClientCount === 1 ? "" : "s"} exempt via override)`
      : "";
  return {
    value: share,
    target: t.maxTelehealthShare,
    met,
    detail: met
      ? `Telehealth ${pct(share)} is within the ${pct(t.maxTelehealthShare)} cap${exemptNote}.`
      : `Telehealth ${pct(share)} exceeds the ${pct(t.maxTelehealthShare)} cap${exemptNote}.`,
  };
}

/**
 * Caregiver-training (97156) hours must meet the target scaled to how much of a
 * quarter the period represents: months = target/3, a full quarter = target,
 * multi-quarter (YTD/all) scales up by the number of months / 3.
 */
export function caregiverTrainingCheck(
  hoursDelivered: number,
  monthsCovered: number,
  t: ComplianceTargets
): ComplianceCheck {
  const quarterEquivalents = monthsCovered > 0 ? monthsCovered / 3 : 1;
  const target = t.caregiverTrainingHoursPerQuarter * quarterEquivalents;
  const met = hoursDelivered >= target - 1e-9;
  return {
    value: hoursDelivered,
    target,
    met,
    detail: met
      ? `${hoursDelivered.toFixed(1)} hrs meets the ${target.toFixed(1)} hr target.`
      : `${hoursDelivered.toFixed(1)} of ${target.toFixed(1)} required caregiver-training hrs.`,
  };
}
