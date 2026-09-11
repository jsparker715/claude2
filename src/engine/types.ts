/**
 * Domain types for the BCBA compliance engine.
 *
 * These types describe DATA ONLY. The engine functions are pure: they take
 * plain arrays/objects in and return plain objects out, with no file access,
 * no network, and no DOM. That is what lets the exact same code run inside:
 *   - Node unit tests (this repo)
 *   - the SharePoint (SPFx) web part
 *   - a Power Automate "Office Script" that runs on the monthly upload
 *
 * Parsing CSV/XLSX into these shapes happens OUTSIDE the engine, in whichever
 * host is calling it.
 */

/** CPT / billing codes we care about. Others are still counted toward total hours. */
export const CODE_DIRECT = "97153"; // direct therapy delivered by a technician
export const CODE_SUPERVISION = "97155"; // protocol modification / supervision by the BCBA
export const CODE_CAREGIVER_TRAINING = "97156"; // caregiver / family training

/**
 * One delivered session. Mirrors the columns the passage-billing-report skill
 * already reads from the Passage Health export, plus an optional telehealth flag.
 */
export interface SessionRow {
  /** Client name (as it appears in the export). */
  client: string;
  /** Staff member who personally delivered the session. */
  teamMember: string;
  /** CPT/billing code, e.g. "97153", "97155", "97156". */
  billingCode: string;
  /** Duration in hours. */
  durationHours: number;
  /** Session date, ISO "YYYY-MM-DD". May be empty/invalid; such rows only land in the Total period. */
  date: string;
  /**
   * True if this session was delivered via telehealth.
   * The host resolves this from whatever column your export actually uses
   * (place-of-service, a "95"/"GT" modifier, a location column, etc.) via
   * TelehealthResolver before the row reaches the engine.
   */
  telehealth?: boolean;
}

/** One approved PTO request. Mirrors the skill's PTO CSV columns. */
export interface PtoRow {
  /** Employee name (may need name-override reconciliation to match a BCBA). */
  employee: string;
  /** Total approved hours for the request. */
  hours: number;
  /** Request start date, ISO "YYYY-MM-DD". */
  startDate: string;
  /** Request end date, ISO "YYYY-MM-DD" (currently informational; hours are spread from startDate). */
  endDate?: string;
}

/** Assignment of a client to the BCBA who owns that client's caseload. */
export interface Pairing {
  bcba: string;
  client: string;
}

/**
 * Per-BCBA configuration and targets. Everything that is a BUSINESS RULE lives
 * here, never hardcoded in the engine, so you can tune thresholds without a code
 * change. Monthly required billable hours come from your requirements sheet.
 */
export interface BcbaConfig {
  /** Canonical BCBA name (matches teamMember / pairing.bcba after normalization). */
  name: string;
  /** Email — the join key for notifications and the web part's identity match. */
  email?: string;
  /** Required billable hours per calendar month, keyed by "YYYY-MM". */
  requiredHoursByMonth: Record<string, number>;
  /** Clinical/billing targets used for compliance + bonus. */
  targets: ComplianceTargets;
}

/**
 * Compliance targets. Defaults are PLACEHOLDERS clearly marked in defaults.ts —
 * replace with the real clinical/billing thresholds before going live.
 */
export interface ComplianceTargets {
  /** Minimum acceptable supervision ratio (97155 / 97153), as a fraction e.g. 0.10 = 10%. */
  minSupervisionRatio: number;
  /** Maximum acceptable supervision ratio, if capped (fraction). Use Infinity for no cap. */
  maxSupervisionRatio: number;
  /** Required caregiver-training (97156) hours per quarter. */
  caregiverTrainingHoursPerQuarter: number;
  /** Maximum share of hours allowed to be telehealth, as a fraction e.g. 0.40 = 40%. */
  maxTelehealthShare: number;
}

/** Whether supervision ratio / telehealth are measured on the whole caseload or only what the BCBA personally delivered. */
export type MeasureBasis = "caseload" | "personallyDelivered";

/** Engine-wide options. */
export interface EngineOptions {
  /** How supervision ratio is measured. Default "caseload". */
  supervisionBasis?: MeasureBasis;
  /** How telehealth share is measured. Default "personallyDelivered". */
  telehealthBasis?: MeasureBasis;
  /** Fraction of a quarter's billable deficit that rolls into the next quarter's target. Default 0.5. */
  rolloverFraction?: number;
  /** Optional cap on rolled-over hours per quarter (Infinity = uncapped). Default Infinity. */
  rolloverCapHours?: number;
  /** Bonus rule parameters (see bonus.ts). */
  bonus?: BonusConfig;
}

/**
 * Bonus rule parameters. The exact dollar figures/gates are a business rule —
 * these are PLACEHOLDERS. bonus.ts documents the formula they drive.
 */
export interface BonusConfig {
  /** Dollars per billable hour delivered ABOVE the (rollover-adjusted) requirement. */
  ratePerHourOverTarget: number;
  /** Bonus is only paid if ALL of these gates pass in the quarter. */
  requireSupervisionRatioMet: boolean;
  requireCaregiverTrainingMet: boolean;
  requireTelehealthWithinCap: boolean;
  /** Optional flat bonus added when every gate passes AND hours target is met. */
  flatOnAllTargetsMet: number;
}
