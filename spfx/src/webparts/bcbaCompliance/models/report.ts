/**
 * Shape of the BcbaReport object the web part reads and renders.
 *
 * This MUST stay in sync with the engine's output types in
 * `../../../../../src/engine/results.ts`. It is a passive copy (types only, no
 * logic) so the web part never bundles the engine — the engine runs monthly in
 * the Power Automate Office Script, and its JSON output lands in the
 * `BCBA Reports` list. Run `npm run sync-engine-types` after changing the engine.
 */

export interface ClientMetrics {
  client: string;
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  totalHours: number;
  supervisionRatio: number | null;
  caregiverTrainingFlag: "OK" | "Did not deliver" | "";
  bcbaCaregiverHours: number;
  caregiverRequiredHours: number;
  caregiverMet: boolean;
}

export interface WeeklyRow {
  weekKey: string;
  weekStart: string;
  billableHours: number;
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  telehealthHours: number;
  sessionCount: number;
}

export interface ComplianceCheck {
  value: number;
  target: number;
  met: boolean;
  detail: string;
}

export interface BonusLine {
  label: string;
  detail: string;
  amount: number;
}

export interface BonusResult {
  eligible: boolean;
  hoursOverTarget: number;
  amount: number;
  breakdown: BonusLine[];
  blockedBy: string[];
}

export interface PeriodReport {
  periodKey: string;
  periodKind: "month" | "quarter" | "ytd" | "all";
  label: string;
  months: string[];
  billableHours: number;
  qualifyingBillableHours: number;
  excludedZeroReqMonths: number;
  directHours: number;
  supervisionHours: number;
  caregiverTrainingHours: number;
  telehealthHours: number;
  sessionCount: number;
  ptoHours: number;
  requiredHours: number | null;
  variance: number | null;
  effectiveRequiredHours: number | null;
  rolledInHours: number;
  rollingOutHours: number;
  supervisionRatioCheck: ComplianceCheck;
  telehealthCheck: ComplianceCheck;
  caregiverTrainingCheck: ComplianceCheck;
  clients: ClientMetrics[];
  bonus: BonusResult;
}

export interface BcbaReport {
  bcba: string;
  email?: string;
  generatedAt?: string;
  periods: PeriodReport[];
  weekly: WeeklyRow[];
  notes?: string;
}
