/**
 * Result shapes produced by the engine. ONE `BcbaReport` object is what gets
 * written to that BCBA's permission-isolated SharePoint item and rendered by the
 * web part. Because each BCBA's report is a self-contained object, the storage
 * layer can secure it per person with no cross-references to peers' data.
 */

/** Metrics for one client on a BCBA's caseload, for one period. */
export interface ClientMetrics {
  client: string;
  directHours: number; // 97153
  supervisionHours: number; // 97155
  caregiverTrainingHours: number; // 97156 total (all providers)
  totalHours: number; // all codes
  /** 97155 / 97153, as a fraction. null when directHours == 0. */
  supervisionRatio: number | null;
  /** "OK" | "Did not deliver" | "" — did THIS bcba personally deliver the 97156 for this client this period. */
  caregiverTrainingFlag: "OK" | "Did not deliver" | "";
  /** 97156 hours THIS bcba personally delivered to this family (drives the per-family requirement). */
  bcbaCaregiverHours: number;
  /** Required family-training hours for this client this period (3/quarter, pro-rated). */
  caregiverRequiredHours: number;
  /** Did this family get its required caregiver-training hours from the BCBA. */
  caregiverMet: boolean;
}

/** One row of the week-by-week breakdown. */
export interface WeeklyRow {
  weekKey: string; // ISO week "YYYY-Www"
  weekStart: string; // Monday, "YYYY-MM-DD"
  billableHours: number; // hours personally delivered that week
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  telehealthHours: number;
  sessionCount: number;
}

/** Compliance evaluation of a single measure against its target. */
export interface ComplianceCheck {
  value: number; // measured value (ratio as fraction, share as fraction, or hours)
  target: number; // the threshold used
  met: boolean;
  /** Human-readable, safe to show the BCBA. */
  detail: string;
}

/** Everything for one BCBA, one period (month / quarter / ytd / total). */
export interface PeriodReport {
  periodKey: string; // "YYYY-MM" | "YYYY-Qn" | "YYYY-YTD" | "ALL"
  periodKind: "month" | "quarter" | "ytd" | "all";
  label: string;
  /** The "YYYY-MM" month keys this period covers (empty for "all", which spans everything). */
  months: string[];

  // Hours personally delivered by the BCBA this period.
  billableHours: number;
  /**
   * Billable hours counted toward the requirement/variance/bonus — excludes any
   * month whose billable requirement is 0 (those months don't help or hurt).
   * Equals billableHours when no month in the period has a 0 requirement.
   */
  qualifyingBillableHours: number;
  /** How many months in this period were excluded for having a 0 requirement. */
  excludedZeroReqMonths: number;
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  telehealthHours: number;
  sessionCount: number;

  ptoHours: number;
  requiredHours: number | null; // null when no requirement configured
  /** billableHours - effectiveRequiredHours. null when required is null. */
  variance: number | null;
  /** requiredHours plus any rolled-in deficit (quarters only). Equals requiredHours otherwise. */
  effectiveRequiredHours: number | null;
  /** Hours rolled IN from the previous quarter's deficit (quarters only). */
  rolledInHours: number;
  /** Deficit rolling OUT to the next quarter (quarters only). */
  rollingOutHours: number;

  supervisionRatioCheck: ComplianceCheck;
  telehealthCheck: ComplianceCheck;
  caregiverTrainingCheck: ComplianceCheck; // meaningful on quarter/ytd/all

  /** Per-client caseload detail for this period. */
  clients: ClientMetrics[];

  /** Bonus for this period (populated for quarters; zeroed elsewhere). */
  bonus: BonusResult;
}

export interface BonusResult {
  eligible: boolean;
  hoursOverTarget: number;
  amount: number;
  /** Line items explaining how `amount` was reached — drives the "easy to view" bonus display. */
  breakdown: BonusLine[];
  /** Gates that blocked the bonus, if any. */
  blockedBy: string[];
}

export interface BonusLine {
  label: string;
  detail: string;
  amount: number;
}

export interface BcbaReport {
  bcba: string;
  email?: string;
  /** ISO timestamp the report was generated (set by the host, not the engine). */
  generatedAt?: string;
  /** Periods in display order: months, then quarters, then YTD, then ALL. */
  periods: PeriodReport[];
  weekly: WeeklyRow[];
  /** Notes are stored/edited separately by the web part; carried here for convenience. */
  notes?: string;
}
