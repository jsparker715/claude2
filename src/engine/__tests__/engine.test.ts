import { test } from "node:test";
import assert from "node:assert/strict";

import { detectPeriods } from "../periods";
import { distributePtoByMonth, ptoForMonths } from "../pto";
import { computeRollover } from "../rollover";
import { personalAggregate, clientMetrics, caseloadSupervisionRatio } from "../metrics";
import { weeklyBreakdown } from "../weekly";
import { isoWeekKey, monthsInQuarter, nextQuarterKey } from "../dateutil";
import { buildBcbaReport, EngineInput } from "../index";
import { SessionRow, PtoRow } from "../types";
import { PLACEHOLDER_TARGETS } from "../defaults";

function s(partial: Partial<SessionRow>): SessionRow {
  return {
    client: "Client A",
    teamMember: "Dr. Sam",
    billingCode: "97153",
    durationHours: 1,
    date: "2026-04-01",
    ...partial,
  };
}

test("dateutil: quarter helpers", () => {
  assert.deepEqual(monthsInQuarter("2026-Q2"), ["2026-04", "2026-05", "2026-06"]);
  assert.equal(nextQuarterKey("2026-Q4"), "2027-Q1");
  assert.equal(nextQuarterKey("2026-Q1"), "2026-Q2");
});

test("isoWeekKey: known dates", () => {
  // 2026-01-01 is a Thursday -> ISO week 1 of 2026.
  assert.equal(isoWeekKey({ year: 2026, month: 1, day: 1 }), "2026-W01");
  // 2026-04-06 is a Monday.
  assert.equal(isoWeekKey({ year: 2026, month: 4, day: 6 }), "2026-W15");
});

test("periods: single month yields month + quarter + total", () => {
  const periods = detectPeriods([s({ date: "2026-04-10" })]);
  assert.deepEqual(periods.map((p) => p.key), ["2026-04", "2026-Q2", "ALL"]);
});

test("periods: multi-year adds YTD columns", () => {
  const periods = detectPeriods([s({ date: "2025-11-01" }), s({ date: "2026-02-01" })]);
  const keys = periods.map((p) => p.key);
  assert.ok(keys.includes("2025-YTD"));
  assert.ok(keys.includes("2026-YTD"));
  assert.equal(keys[keys.length - 1], "ALL");
});

test("pto: distributes 8h/day and splits across month boundary", () => {
  // 20 hours from Apr 30 -> 8 (Apr 30), 8 (May 1), 4 (May 2).
  const byMonth = distributePtoByMonth([
    { employee: "X", hours: 20, startDate: "2026-04-30" } as PtoRow,
  ]);
  assert.equal(byMonth["2026-04"], 8);
  assert.equal(byMonth["2026-05"], 12);
  assert.equal(ptoForMonths(byMonth, ["2026-04", "2026-05"]), 20);
});

test("metrics: personal aggregate counts only the BCBA's own sessions", () => {
  const sessions = [
    s({ teamMember: "Dr. Sam", billingCode: "97153", durationHours: 2 }),
    s({ teamMember: "Dr. Sam", billingCode: "97155", durationHours: 1, telehealth: true }),
    s({ teamMember: "Tech Joe", billingCode: "97153", durationHours: 5 }), // not Sam
  ];
  const agg = personalAggregate(sessions, "Dr. Sam");
  assert.equal(agg.billableHours, 3);
  assert.equal(agg.directHours, 2);
  assert.equal(agg.supervisionHours, 1);
  assert.equal(agg.telehealthHours, 1);
  assert.equal(agg.sessionCount, 2);
});

test("metrics: client totals sum across team members; ratio + 97156 flag per BCBA", () => {
  const sessions = [
    s({ client: "Client A", teamMember: "Tech Joe", billingCode: "97153", durationHours: 10 }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 2 }),
    s({ client: "Client A", teamMember: "Tech Joe", billingCode: "97156", durationHours: 1 }), // Sam did NOT deliver
  ];
  const [m] = clientMetrics(sessions, "Dr. Sam", ["Client A"]);
  assert.equal(m.directHours, 10);
  assert.equal(m.supervisionHours, 2);
  assert.equal(m.caregiverTrainingHours, 1);
  assert.equal(m.supervisionRatio, 0.2);
  assert.equal(m.caregiverTrainingFlag, "Did not deliver");

  const caseload = caseloadSupervisionRatio([m]);
  assert.equal(caseload.ratio, 0.2);
});

test("metrics: 97156 flag OK when the BCBA personally delivered it", () => {
  const sessions = [
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97156", durationHours: 1 }),
  ];
  const [m] = clientMetrics(sessions, "Dr. Sam", ["Client A"]);
  assert.equal(m.caregiverTrainingFlag, "OK");
});

test("rollover: 50% of a Q1 deficit lands on Q2's target", () => {
  const map = computeRollover(
    [
      { quarterKey: "2026-Q1", baseRequired: 100, billable: 80 }, // deficit 20 -> roll 10
      { quarterKey: "2026-Q2", baseRequired: 100, billable: 100 },
    ],
    0.5
  );
  const q1 = map.get("2026-Q1")!;
  const q2 = map.get("2026-Q2")!;
  assert.equal(q1.variance, -20);
  assert.equal(q1.rollingOut, 10);
  assert.equal(q2.rolledIn, 10);
  assert.equal(q2.effectiveRequired, 110);
  assert.equal(q2.variance, -10); // 100 billed against 110 effective
});

test("rollover: no carry when the next calendar quarter is absent", () => {
  const map = computeRollover(
    [{ quarterKey: "2026-Q1", baseRequired: 100, billable: 50 }],
    0.5
  );
  assert.equal(map.get("2026-Q1")!.rollingOut, 0);
});

test("rollover: compounds when a carried deficit is missed again", () => {
  const map = computeRollover(
    [
      { quarterKey: "2026-Q1", baseRequired: 100, billable: 80 }, // roll 10
      { quarterKey: "2026-Q2", baseRequired: 100, billable: 90 }, // eff 110, deficit 20 -> roll 10
      { quarterKey: "2026-Q3", baseRequired: 100, billable: 100 },
    ],
    0.5
  );
  assert.equal(map.get("2026-Q2")!.effectiveRequired, 110);
  assert.equal(map.get("2026-Q2")!.rollingOut, 10);
  assert.equal(map.get("2026-Q3")!.effectiveRequired, 110);
});

test("weekly: groups the BCBA's sessions by ISO week", () => {
  const rows = weeklyBreakdown(
    [
      s({ date: "2026-04-06", durationHours: 2 }), // W15
      s({ date: "2026-04-07", durationHours: 1 }), // W15
      s({ date: "2026-04-13", durationHours: 3 }), // W16
    ],
    "Dr. Sam"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].weekKey, "2026-W15");
  assert.equal(rows[0].billableHours, 3);
  assert.equal(rows[1].billableHours, 3);
});

test("buildBcbaReport: end-to-end shape and isolation to assigned clients", () => {
  const sessions: SessionRow[] = [
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97153", durationHours: 30, date: "2026-04-10" }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 5, date: "2026-04-10" }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97156", durationHours: 6, date: "2026-05-10" }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97153", durationHours: 10, telehealth: true, date: "2026-06-10" }),
    // A peer's client that Sam is NOT assigned — must not appear on Sam's caseload.
    s({ client: "Client Z", teamMember: "Dr. Pat", billingCode: "97153", durationHours: 99, date: "2026-04-10" }),
  ];
  const input: EngineInput = {
    sessions,
    pto: [{ employee: "Dr. Sam", hours: 8, startDate: "2026-04-15" } as PtoRow],
    pairings: [{ bcba: "Dr. Sam", client: "Client A" }],
    config: {
      name: "Dr. Sam",
      email: "sam@example.com",
      requiredHoursByMonth: { "2026-04": 40, "2026-05": 40, "2026-06": 40 },
      targets: PLACEHOLDER_TARGETS,
    },
  };
  const report = buildBcbaReport(input);

  // Quarter present.
  const q2 = report.periods.find((p) => p.periodKey === "2026-Q2")!;
  assert.ok(q2, "Q2 period exists");
  assert.equal(q2.billableHours, 51); // 30+5+6+10
  assert.equal(q2.requiredHours, 120); // 3 x 40
  assert.equal(q2.variance, -69);
  assert.equal(q2.ptoHours, 8);

  // Only the assigned client shows up.
  assert.deepEqual(q2.clients.map((c) => c.client), ["Client A"]);

  // Telehealth: 10 of 51 personally-delivered hours.
  assert.ok(Math.abs(q2.telehealthCheck.value - 10 / 51) < 1e-9);

  // Bonus blocked (under hours target) — placeholder gates require caregiver etc.
  assert.equal(q2.bonus.amount, 0);

  // Weekly rows exist.
  assert.ok(report.weekly.length >= 1);
});

test("buildBcbaReport: bonus pays when over target and gates pass", () => {
  const sessions: SessionRow[] = [
    // Enough direct+supervision to clear the ratio and hours target, plus caregiver training.
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97153", durationHours: 100, date: "2026-04-10" }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 20, date: "2026-04-10" }),
    s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97156", durationHours: 6, date: "2026-04-10" }),
  ];
  const report = buildBcbaReport({
    sessions,
    pto: [],
    pairings: [{ bcba: "Dr. Sam", client: "Client A" }],
    config: {
      name: "Dr. Sam",
      requiredHoursByMonth: { "2026-04": 40, "2026-05": 0, "2026-06": 0 },
      targets: PLACEHOLDER_TARGETS,
    },
  });
  const q2 = report.periods.find((p) => p.periodKey === "2026-Q2")!;
  // billable 126, required 40 -> 86 over target. Bonus = 86*$40 + (6-3)*$20 = 3440 + 60.
  assert.equal(q2.bonus.eligible, true);
  assert.equal(q2.bonus.hoursOverTarget, 86);
  assert.equal(q2.bonus.amount, 86 * 40 + 3 * 20);
});

test("bonus: caregiver-excess bonus is withheld until the billable minimum is met", () => {
  // Billable under requirement -> no hours-over bonus, and caregiver excess is blocked.
  const report = buildBcbaReport({
    sessions: [
      s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 10, date: "2026-04-10" }),
      s({ client: "Client A", teamMember: "Dr. Sam", billingCode: "97156", durationHours: 9, date: "2026-04-10" }),
    ],
    pto: [],
    pairings: [{ bcba: "Dr. Sam", client: "Client A" }],
    config: {
      name: "Dr. Sam",
      requiredHoursByMonth: { "2026-04": 40, "2026-05": 40, "2026-06": 40 }, // 120/qtr, billable only 19
      targets: PLACEHOLDER_TARGETS,
    },
  });
  const q2 = report.periods.find((p) => p.periodKey === "2026-Q2")!;
  assert.equal(q2.bonus.amount, 0);
  assert.equal(q2.bonus.eligible, false);
  assert.ok(q2.bonus.blockedBy.some((b) => /billable requirement not met/i.test(b)));
});

test("telehealth override: exempt client is excluded from the cap", () => {
  const sessions: SessionRow[] = [
    // Assigned exempt client: heavy telehealth that should NOT count against the cap.
    s({ client: "Client Exempt", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 10, telehealth: true, date: "2026-04-10" }),
    // Regular client: all in person.
    s({ client: "Client Reg", teamMember: "Dr. Sam", billingCode: "97155", durationHours: 10, date: "2026-04-10" }),
  ];
  const base = {
    sessions,
    pto: [] as PtoRow[],
    pairings: [
      { bcba: "Dr. Sam", client: "Client Exempt" },
      { bcba: "Dr. Sam", client: "Client Reg" },
    ],
    config: { name: "Dr. Sam", requiredHoursByMonth: {}, targets: PLACEHOLDER_TARGETS },
  };
  const without = buildBcbaReport(base).periods.find((p) => p.periodKey === "2026-Q2")!;
  const withOverride = buildBcbaReport({ ...base, telehealthOverrideClients: ["Client Exempt"] }).periods.find(
    (p) => p.periodKey === "2026-Q2"
  )!;
  // Without override: 10 of 20 hrs telehealth = 50%.
  assert.equal(without.telehealthCheck.value, 0.5);
  // With override: exempt client dropped entirely -> 0 of 10 = 0%.
  assert.equal(withOverride.telehealthCheck.value, 0);
  assert.equal(withOverride.telehealthCheck.met, true);
});
