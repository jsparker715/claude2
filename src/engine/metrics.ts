/**
 * Metric computation over a set of sessions already filtered to a period.
 *
 * Two views, matching the skill:
 *  - "personally delivered" — rows where teamMember == the BCBA. Drives billable
 *    hours, telehealth %, PTO variance, bonus.
 *  - "caseload / client totals" — hours for an assigned client summed across ALL
 *    team members. Drives the supervision ratio and the per-client table. The
 *    97156 flag is still evaluated per-BCBA (did THIS bcba deliver it).
 */
import { SessionRow, CODE_DIRECT, CODE_SUPERVISION, CODE_CAREGIVER_TRAINING } from "./types";
import { ClientMetrics } from "./results";
import { normalizeName } from "./names";
import { parseISODate, monthKey } from "./dateutil";
import { PeriodDef } from "./periods";

export interface PersonalAggregate {
  billableHours: number;
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  telehealthHours: number;
  sessionCount: number;
}

export function emptyAggregate(): PersonalAggregate {
  return {
    billableHours: 0,
    directHours: 0,
    supervisionHours: 0,
    caregiverTrainingHours: 0,
    telehealthHours: 0,
    sessionCount: 0,
  };
}

/** True if a session belongs to a period (undated sessions only count for "all"). */
export function sessionInPeriod(s: SessionRow, period: PeriodDef): boolean {
  const d = parseISODate(s.date);
  if (!d) return period.kind === "all";
  return period.includesMonth(monthKey(d));
}

/** Sum the BCBA's personally-delivered metrics over the given sessions. */
export function personalAggregate(sessions: SessionRow[], bcba: string): PersonalAggregate {
  const target = normalizeName(bcba);
  const agg = emptyAggregate();
  for (const s of sessions) {
    if (normalizeName(s.teamMember) !== target) continue;
    const hrs = Number(s.durationHours) || 0;
    agg.billableHours += hrs;
    agg.sessionCount += 1;
    if (s.billingCode === CODE_DIRECT) agg.directHours += hrs;
    else if (s.billingCode === CODE_SUPERVISION) agg.supervisionHours += hrs;
    else if (s.billingCode === CODE_CAREGIVER_TRAINING) agg.caregiverTrainingHours += hrs;
    if (s.telehealth) agg.telehealthHours += hrs;
  }
  return agg;
}

/**
 * Per-client caseload metrics for the assigned clients, over the given sessions.
 * Client hours are summed across all team members; the caregiver-training flag
 * reflects whether `bcba` personally delivered a 97156 for that client here.
 */
export function clientMetrics(
  sessions: SessionRow[],
  bcba: string,
  assignedClients: string[]
): ClientMetrics[] {
  const target = normalizeName(bcba);
  const wanted = new Map<string, string>(); // normalized -> display
  for (const c of assignedClients) wanted.set(normalizeName(c), c);

  interface Acc {
    display: string;
    direct: number;
    supervision: number;
    caregiver: number;
    total: number;
    bcbaDeliveredCaregiver: boolean;
  }
  const accs = new Map<string, Acc>();
  for (const [norm, disp] of wanted) {
    accs.set(norm, {
      display: disp,
      direct: 0,
      supervision: 0,
      caregiver: 0,
      total: 0,
      bcbaDeliveredCaregiver: false,
    });
  }

  for (const s of sessions) {
    const cNorm = normalizeName(s.client);
    const acc = accs.get(cNorm);
    if (!acc) continue; // not an assigned client
    const hrs = Number(s.durationHours) || 0;
    acc.total += hrs;
    if (s.billingCode === CODE_DIRECT) acc.direct += hrs;
    else if (s.billingCode === CODE_SUPERVISION) acc.supervision += hrs;
    else if (s.billingCode === CODE_CAREGIVER_TRAINING) {
      acc.caregiver += hrs;
      if (normalizeName(s.teamMember) === target && hrs > 0) acc.bcbaDeliveredCaregiver = true;
    }
  }

  const out: ClientMetrics[] = [];
  for (const acc of accs.values()) {
    let flag: ClientMetrics["caregiverTrainingFlag"] = "";
    if (acc.caregiver > 0) flag = acc.bcbaDeliveredCaregiver ? "OK" : "Did not deliver";
    out.push({
      client: acc.display,
      directHours: acc.direct,
      supervisionHours: acc.supervision,
      caregiverTrainingHours: acc.caregiver,
      totalHours: acc.total,
      supervisionRatio: acc.direct > 0 ? acc.supervision / acc.direct : null,
      caregiverTrainingFlag: flag,
    });
  }
  out.sort((a, b) => a.client.localeCompare(b.client));
  return out;
}

/** Aggregate caseload supervision ratio: sum(97155)/sum(97153) across assigned clients. */
export function caseloadSupervisionRatio(clients: ClientMetrics[]): {
  ratio: number | null;
  supervision: number;
  direct: number;
} {
  let sup = 0;
  let dir = 0;
  for (const c of clients) {
    sup += c.supervisionHours;
    dir += c.directHours;
  }
  return { ratio: dir > 0 ? sup / dir : null, supervision: sup, direct: dir };
}
