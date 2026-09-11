/**
 * Engine entry point. `buildBcbaReport` produces ONE self-contained report for
 * ONE BCBA — the exact object the monthly job writes to that BCBA's
 * permission-isolated SharePoint item and the web part renders. No report
 * references any other BCBA's data, which is what makes per-person permission
 * isolation clean.
 *
 * `buildAllReports` is the convenience the monthly Office Script calls: hand it
 * ALL sessions + ALL pto + ALL pairings + every BCBA's config, get back one
 * report per BCBA to write out to each secured location.
 */
import { SessionRow, PtoRow, Pairing, BcbaConfig, EngineOptions } from "./types";
import {
  BcbaReport,
  PeriodReport,
  ComplianceCheck,
} from "./results";
import { normalizeName, canonicalName } from "./names";
import { detectPeriods, PeriodDef } from "./periods";
import {
  personalAggregate,
  clientMetrics,
  caseloadSupervisionRatio,
  sessionInPeriod,
  PersonalAggregate,
} from "./metrics";
import { distributePtoByMonth, ptoForMonths } from "./pto";
import { weeklyBreakdown } from "./weekly";
import {
  supervisionRatioCheck,
  telehealthCheck,
  caregiverTrainingCheck,
} from "./compliance";
import { computeRollover, QuarterInput } from "./rollover";
import { computeBonus, zeroBonus } from "./bonus";
import { DEFAULT_OPTIONS } from "./defaults";

export * from "./types";
export * from "./results";
export { detectPeriods } from "./periods";
export { computeRollover } from "./rollover";
export { isTelehealthLocation, TELEHEALTH_LOCATION_VALUES } from "./telehealth";

export interface EngineInput {
  sessions: SessionRow[];
  pto: PtoRow[];
  pairings: Pairing[];
  config: BcbaConfig;
  options?: EngineOptions;
  /** Optional PTO name reconciliation map (nickname -> canonical BCBA name). */
  ptoNameOverrides?: Record<string, string>;
  /** Clients with a telehealth override — excluded from the telehealth cap. */
  telehealthOverrideClients?: string[];
}

function resolveOptions(options?: EngineOptions) {
  return {
    supervisionBasis: options?.supervisionBasis ?? DEFAULT_OPTIONS.supervisionBasis,
    telehealthBasis: options?.telehealthBasis ?? DEFAULT_OPTIONS.telehealthBasis,
    rolloverFraction: options?.rolloverFraction ?? DEFAULT_OPTIONS.rolloverFraction,
    rolloverCapHours: options?.rolloverCapHours ?? DEFAULT_OPTIONS.rolloverCapHours,
    bonus: options?.bonus ?? DEFAULT_OPTIONS.bonus,
  };
}

/**
 * Telehealth share for the cap check. Clients in `exemptNorm` (per-client
 * override) are excluded from BOTH numerator and denominator, so approved
 * telehealth never counts against the BCBA.
 *   - basis "personallyDelivered": rows the BCBA delivered
 *   - basis "caseload": rows for assigned clients, any provider
 */
function telehealthShare(
  periodSessions: SessionRow[],
  opts: {
    basis: "caseload" | "personallyDelivered";
    bcbaNorm: string;
    assignedNorm: Set<string>;
    exemptNorm: Set<string>;
  }
): number {
  let telehealth = 0;
  let total = 0;
  for (const s of periodSessions) {
    const cNorm = normalizeName(s.client);
    if (opts.exemptNorm.has(cNorm)) continue; // approved telehealth — off the cap
    if (opts.basis === "personallyDelivered") {
      if (normalizeName(s.teamMember) !== opts.bcbaNorm) continue;
    } else {
      if (!opts.assignedNorm.has(cNorm)) continue;
    }
    const hrs = Number(s.durationHours) || 0;
    total += hrs;
    if (s.telehealth) telehealth += hrs;
  }
  return total > 0 ? telehealth / total : 0;
}

function requiredForMonths(cfg: BcbaConfig, months: string[]): number | null {
  let sum = 0;
  let any = false;
  for (const m of months) {
    if (Object.prototype.hasOwnProperty.call(cfg.requiredHoursByMonth, m)) {
      sum += cfg.requiredHoursByMonth[m];
      any = true;
    }
  }
  return any ? sum : null;
}

export function buildBcbaReport(input: EngineInput): BcbaReport {
  const opt = resolveOptions(input.options);
  const bcba = normalizeName(input.config.name);
  const targets = input.config.targets;

  // Clients assigned to this BCBA.
  const assignedClients: string[] = [];
  const assignedSeen = new Set<string>();
  const assignedNorm = new Set<string>();
  for (const p of input.pairings) {
    if (normalizeName(p.bcba) !== bcba) continue;
    const norm = normalizeName(p.client);
    if (!norm || assignedSeen.has(norm)) continue;
    assignedSeen.add(norm);
    assignedNorm.add(norm);
    assignedClients.push(p.client);
  }

  // Clients with a telehealth override (excluded from the telehealth cap).
  const exemptNorm = new Set<string>();
  for (const c of input.telehealthOverrideClients || []) exemptNorm.add(normalizeName(c));
  let exemptAssignedCount = 0;
  for (const n of assignedNorm) if (exemptNorm.has(n)) exemptAssignedCount++;

  // PTO for this BCBA (respecting name overrides), distributed to months.
  const myPto = input.pto.filter(
    (r) => canonicalName(r.employee, input.ptoNameOverrides) === bcba
  );
  const ptoByMonth = distributePtoByMonth(myPto);

  const periods = detectPeriods(input.sessions);

  // Phase 1: raw per-period aggregates.
  interface Raw {
    def: PeriodDef;
    personal: PersonalAggregate;
    clients: ReturnType<typeof clientMetrics>;
    supRatio: number | null;
    ptoHours: number;
    baseRequired: number | null;
    supCheck: ComplianceCheck;
    teleCheck: ComplianceCheck;
    caregiverCheck: ComplianceCheck;
  }
  const raws: Raw[] = periods.map((def) => {
    const periodSessions = input.sessions.filter((s) => sessionInPeriod(s, def));
    const personal = personalAggregate(periodSessions, bcba);
    const clients = clientMetrics(periodSessions, bcba, assignedClients);

    // Supervision ratio basis.
    let supRatio: number | null;
    if (opt.supervisionBasis === "personallyDelivered") {
      supRatio = personal.directHours > 0 ? personal.supervisionHours / personal.directHours : null;
    } else {
      supRatio = caseloadSupervisionRatio(clients).ratio;
    }

    // Telehealth share for the cap (exempt clients excluded from both sides).
    const teleShare = telehealthShare(periodSessions, {
      basis: opt.telehealthBasis,
      bcbaNorm: bcba,
      assignedNorm,
      exemptNorm,
    });

    const ptoHours = ptoForMonths(ptoByMonth, def.months);
    const baseRequired = requiredForMonths(input.config, def.months);
    const monthsCovered = def.kind === "all" ? def.months.length || 3 : def.months.length;

    return {
      def,
      personal,
      clients,
      supRatio,
      ptoHours,
      baseRequired,
      supCheck: supervisionRatioCheck(supRatio, targets),
      teleCheck: telehealthCheck(teleShare, targets, exemptAssignedCount),
      caregiverCheck: caregiverTrainingCheck(personal.caregiverTrainingHours, monthsCovered, targets),
    };
  });

  // Phase 2: quarterly rollover.
  const quarterInputs: QuarterInput[] = raws
    .filter((r) => r.def.kind === "quarter")
    .map((r) => ({
      quarterKey: r.def.key,
      baseRequired: r.baseRequired,
      billable: r.personal.billableHours,
    }));
  const rollover = computeRollover(quarterInputs, opt.rolloverFraction, opt.rolloverCapHours);

  // Phase 3: assemble period reports (+ bonus on quarters).
  const periodReports: PeriodReport[] = raws.map((r) => {
    let effectiveRequired = r.baseRequired;
    let variance = r.baseRequired === null ? null : r.personal.billableHours - r.baseRequired;
    let rolledIn = 0;
    let rollingOut = 0;

    if (r.def.kind === "quarter") {
      const ro = rollover.get(r.def.key);
      if (ro) {
        effectiveRequired = ro.effectiveRequired;
        variance = ro.variance;
        rolledIn = ro.rolledIn;
        rollingOut = ro.rollingOut;
      }
    }

    const bonus =
      r.def.kind === "quarter"
        ? computeBonus(
            {
              billableHours: r.personal.billableHours,
              effectiveRequiredHours: effectiveRequired,
              caregiverTrainingHours: r.personal.caregiverTrainingHours,
            },
            opt.bonus
          )
        : zeroBonus();

    return {
      periodKey: r.def.key,
      periodKind: r.def.kind,
      label: r.def.label,
      months: r.def.months.slice(),
      billableHours: r.personal.billableHours,
      directHours: r.personal.directHours,
      supervisionHours: r.personal.supervisionHours,
      caregiverTrainingHours: r.personal.caregiverTrainingHours,
      telehealthHours: r.personal.telehealthHours,
      sessionCount: r.personal.sessionCount,
      ptoHours: r.ptoHours,
      requiredHours: r.baseRequired,
      variance,
      effectiveRequiredHours: effectiveRequired,
      rolledInHours: rolledIn,
      rollingOutHours: rollingOut,
      supervisionRatioCheck: r.supCheck,
      telehealthCheck: r.teleCheck,
      caregiverTrainingCheck: r.caregiverCheck,
      clients: r.clients,
      bonus,
    };
  });

  return {
    bcba: input.config.name,
    email: input.config.email,
    periods: periodReports,
    weekly: weeklyBreakdown(input.sessions, bcba),
  };
}

export interface AllReportsInput {
  sessions: SessionRow[];
  pto: PtoRow[];
  pairings: Pairing[];
  configs: BcbaConfig[];
  options?: EngineOptions;
  ptoNameOverrides?: Record<string, string>;
  telehealthOverrideClients?: string[];
}

/** Build one report per BCBA config. */
export function buildAllReports(input: AllReportsInput): BcbaReport[] {
  return input.configs.map((config) =>
    buildBcbaReport({
      sessions: input.sessions,
      pto: input.pto,
      pairings: input.pairings,
      config,
      options: input.options,
      ptoNameOverrides: input.ptoNameOverrides,
      telehealthOverrideClients: input.telehealthOverrideClients,
    })
  );
}
