/**
 * Turn measured values into ComplianceCheck objects the web part can render
 * directly. Ratios and shares are fractions (0.10 == 10%).
 */
import { ComplianceTargets } from "./types";
import { ComplianceCheck, ClientMetrics } from "./results";

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
 * Caregiver training is PER FAMILY: every assigned client's family must get the
 * required caregiver-training hours (3/quarter, pro-rated) from the BCBA. The
 * check passes only when all families are met. `value` = families met,
 * `target` = families total.
 */
export function caregiverTrainingCheck(clients: ClientMetrics[], perQuarter: number, monthsCovered: number): ComplianceCheck {
  const quarterEquivalents = monthsCovered > 0 ? monthsCovered / 3 : 1;
  const perFamily = perQuarter * quarterEquivalents;
  const total = clients.length;
  const met = clients.filter((c) => c.caregiverMet).length;
  if (total === 0) {
    return { value: 0, target: 0, met: true, detail: "No assigned families this period." };
  }
  const shortfalls = clients.filter((c) => !c.caregiverMet).map((c) => c.client);
  const allMet = met === total;
  return {
    value: met,
    target: total,
    met: allMet,
    detail: allMet
      ? `All ${total} famil${total === 1 ? "y" : "ies"} met the ${perFamily.toFixed(1)} hr/family target.`
      : `${met} of ${total} families met the ${perFamily.toFixed(1)} hr/family target. Behind: ${shortfalls.join(", ")}.`,
  };
}
