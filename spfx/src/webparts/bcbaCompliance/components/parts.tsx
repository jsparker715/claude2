import * as React from "react";
import styles from "./BcbaCompliance.module.scss";
import { BcbaReport, PeriodReport, ComplianceCheck } from "../models/report";
import { fmt, money, pct, monthOf, periodKindLabel } from "./format";

function cn(...c: (string | false | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

const Chip: React.FC<{ kind: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode; dot?: boolean }> = (p) => {
  const map = { good: styles.cGood, warn: styles.cWarn, bad: styles.cBad, neutral: styles.cNeutral };
  return (
    <span className={cn(styles.chip, map[p.kind])}>
      {p.dot !== false && p.kind !== "neutral" ? <span className={styles.dot} /> : null}
      {p.children}
    </span>
  );
};

export const PeriodPills: React.FC<{
  periods: PeriodReport[];
  selected: string;
  onSelect: (key: string) => void;
}> = ({ periods, selected, onSelect }) => (
  <div className={styles.periods} role="tablist" aria-label="Reporting period">
    {periods.map((p) => {
      const k = periodKindLabel(p.periodKind);
      return (
        <button
          key={p.periodKey}
          type="button"
          role="tab"
          aria-selected={p.periodKey === selected}
          className={cn(styles.pill, p.periodKey === selected && styles.pillActive)}
          onClick={() => onSelect(p.periodKey)}
        >
          {k ? <span className={styles.k}>{k}</span> : null}
          {p.label}
        </button>
      );
    })}
  </div>
);

function varianceChip(period: PeriodReport): JSX.Element {
  if (period.variance === null) return <Chip kind="neutral">no target set</Chip>;
  const over = period.variance >= 0;
  return (
    <Chip kind={over ? "good" : "bad"}>
      {(over ? "+" : "") + fmt(period.variance)} hrs vs target
    </Chip>
  );
}

export const KpiTiles: React.FC<{ period: PeriodReport }> = ({ period }) => {
  const isQ = period.periodKind === "quarter";
  const req = period.effectiveRequiredHours === null ? "—" : fmt(period.effectiveRequiredHours, 0);
  const billStripe = period.variance === null ? styles.sAccent : period.variance >= 0 ? styles.sGood : styles.sBad;
  const sc = period.supervisionRatioCheck;
  const tc = period.telehealthCheck;

  return (
    <div className={styles.kpis}>
      <div className={styles.tile}>
        <span className={cn(styles.stripe, billStripe)} />
        <div className={styles.cap}>Billable hours</div>
        <div className={styles.big}>
          {fmt(period.billableHours, 0)}
          <span className={styles.unit}>/ {req} hrs</span>
        </div>
        <div className={styles.meta}>{varianceChip(period)}</div>
        {period.rolledInHours > 0 ? (
          <div className={styles.meta}>
            Target includes <b>{fmt(period.rolledInHours)} hrs</b> rolled in from last quarter.
          </div>
        ) : null}
      </div>

      <div className={styles.tile}>
        <span className={cn(styles.stripe, sc.met ? styles.sGood : styles.sBad)} />
        <div className={styles.cap}>Supervision ratio 97155:97153</div>
        <div className={styles.big}>{sc.value ? pct(sc.value) : "—"}</div>
        <div className={styles.meta}>
          <Chip kind={sc.met ? "good" : "bad"}>{sc.met ? "within target" : "out of target"}</Chip>
        </div>
      </div>

      <div className={styles.tile}>
        <span className={cn(styles.stripe, tc.met ? styles.sGood : styles.sBad)} />
        <div className={styles.cap}>Telehealth share</div>
        <div className={styles.big}>{pct(tc.value)}</div>
        <div className={styles.meta}>
          <Chip kind={tc.met ? "good" : "bad"}>
            {tc.met ? "within cap" : "over cap"} ({pct(tc.target)})
          </Chip>
        </div>
      </div>

      {isQ ? <BonusTile period={period} /> : <CaregiverTile period={period} />}
    </div>
  );
};

const BonusTile: React.FC<{ period: PeriodReport }> = ({ period }) => {
  const bn = period.bonus;
  const stripe = bn.amount > 0 ? styles.sGood : bn.eligible ? styles.sAccent : styles.sWarn;
  return (
    <div className={cn(styles.tile, styles.tileBonus)}>
      <span className={cn(styles.stripe, stripe)} />
      <div className={styles.cap}>Est. quarterly bonus</div>
      <div className={styles.big}>{money(bn.amount)}</div>
      <div className={styles.meta}>
        {bn.amount > 0 ? (
          <Chip kind="good">{fmt(bn.hoursOverTarget)} hrs over requirement</Chip>
        ) : bn.eligible ? (
          <Chip kind="neutral">at requirement</Chip>
        ) : (
          <Chip kind="warn">under requirement</Chip>
        )}
      </div>
    </div>
  );
};

const CaregiverTile: React.FC<{ period: PeriodReport }> = ({ period }) => {
  const cc = period.caregiverTrainingCheck;
  return (
    <div className={styles.tile}>
      <span className={cn(styles.stripe, cc.met ? styles.sGood : styles.sWarn)} />
      <div className={styles.cap}>Caregiver training 97156</div>
      <div className={styles.big}>
        {fmt(cc.value)}
        <span className={styles.unit}>hrs</span>
      </div>
      <div className={styles.meta}>
        <Chip kind={cc.met ? "good" : "warn"}>{cc.met ? "target met" : `below ${fmt(cc.target)} hr target`}</Chip>
      </div>
    </div>
  );
};

const GateRow: React.FC<{ check: ComplianceCheck; title: string; value: string; first?: boolean }> = ({
  check,
  title,
  value,
  first,
}) => (
  <div className={cn(styles.gate, first && styles.gateFirst)}>
    <div className={cn(styles.gIco, check.met ? styles.cGood : styles.cBad)}>{check.met ? "✓" : "✕"}</div>
    <div className={styles.gBody}>
      <div className="t" style={{ fontWeight: 600, fontSize: 13.5 }}>
        {title}
      </div>
      <div className="d" style={{ fontSize: 12, color: "var(--ink2)" }}>
        {check.detail}
      </div>
    </div>
    <div className={styles.gVal}>{value}</div>
  </div>
);

export const ComplianceGates: React.FC<{ period: PeriodReport }> = ({ period }) => (
  <div>
    <GateRow first check={period.supervisionRatioCheck} title="Supervision ratio" value={period.supervisionRatioCheck.value ? pct(period.supervisionRatioCheck.value) : "—"} />
    <GateRow check={period.telehealthCheck} title="Telehealth cap" value={pct(period.telehealthCheck.value)} />
    <GateRow check={period.caregiverTrainingCheck} title="Caregiver training" value={`${fmt(period.caregiverTrainingCheck.value)} hrs`} />
  </div>
);

export const BonusCard: React.FC<{ report: BcbaReport; period: PeriodReport }> = ({ report, period }) => {
  if (period.periodKind !== "quarter") {
    const quarters = report.periods.filter((p) => p.periodKind === "quarter").map((p) => p.label);
    return (
      <div>
        <p className={styles.hint}>Bonus is calculated per quarter.</p>
        {quarters.length ? (
          <p className={styles.hint} style={{ marginTop: 10 }}>
            Select a quarter ({quarters.join(", ")}) to see the bonus breakdown.
          </p>
        ) : null}
      </div>
    );
  }
  const bn = period.bonus;
  return (
    <div>
      <p className={styles.hint}>
        $40/hr for hours over your requirement, plus $20/hr for caregiver training (97156) above 3 hrs/quarter once the
        billable minimum is met.
      </p>
      {bn.amount > 0 ? (
        <>
          <div className={styles.bonusAmt}>{money(bn.amount)}</div>
          {bn.breakdown.map((l, i) => (
            <div key={i} className={cn(styles.bonusLine, i === 0 && styles.bonusLineFirst)}>
              <div className={styles.lab}>
                <b>{l.label}</b>
                <br />
                {l.detail}
              </div>
              <div className={styles.amt}>{money(l.amount)}</div>
            </div>
          ))}
          {bn.breakdown.length > 1 ? (
            <div className={cn(styles.bonusLine, styles.bonusLineTotal)}>
              <div className={styles.lab}>
                <b>Total</b>
              </div>
              <div className={styles.amt}>{money(bn.amount)}</div>
            </div>
          ) : null}
        </>
      ) : bn.eligible ? (
        <>
          <div className={styles.bonusAmt}>$0</div>
          <p className={styles.hint}>
            Billable requirement met — the bonus starts once you go over, and rewards caregiver-training hours beyond 3.
          </p>
        </>
      ) : (
        <>
          <div className={styles.bonusAmt} style={{ color: "var(--ink3)" }}>
            $0
          </div>
          <div className={styles.blocked}>
            <div className="h" style={{ color: "var(--bad)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              Not yet earned
            </div>
            {bn.blockedBy.map((b, i) => (
              <div key={i}>• {b}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const RolloverFlow: React.FC<{ period: PeriodReport }> = ({ period }) => {
  const arrow = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
  if (period.rolledInHours > 0 && period.effectiveRequiredHours !== null) {
    const base = period.effectiveRequiredHours - period.rolledInHours;
    return (
      <div className={styles.rollover}>
        <div className={styles.roBox}>
          <div className="lbl" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink3)" }}>Base target</div>
          <div className="v" style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>{fmt(base, 0)} hrs</div>
          <div className="s" style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 3 }}>standard requirement</div>
        </div>
        <div className={styles.arrow}>
          {arrow}
          <div className="m" style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2, textAlign: "center" }}>
            + {fmt(period.rolledInHours)} hrs<br />rolled in
          </div>
        </div>
        <div className={cn(styles.roBox, styles.roBoxAccent)}>
          <div className="lbl" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent)" }}>Effective target</div>
          <div className="v" style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>{fmt(period.effectiveRequiredHours, 0)} hrs</div>
          <div className="s" style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 3 }}>
            {period.variance !== null ? `${period.variance >= 0 ? "+" : ""}${fmt(period.variance)} hrs vs target` : ""}
          </div>
        </div>
      </div>
    );
  }
  // rolling out
  return (
    <div className={styles.rollover}>
      <div className={styles.roBox}>
        <div className="lbl" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink3)" }}>This quarter&rsquo;s shortfall</div>
        <div className="v" style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>{fmt(Math.abs(period.variance || 0), 0)} hrs</div>
        <div className="s" style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 3 }}>below the {fmt(period.effectiveRequiredHours, 0)} hr target</div>
      </div>
      <div className={styles.arrow}>
        {arrow}
        <div className="m" style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2, textAlign: "center" }}>50% carries</div>
      </div>
      <div className={cn(styles.roBox, styles.roBoxAccent)}>
        <div className="lbl" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent)" }}>Rolls to next quarter</div>
        <div className="v" style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>+{fmt(period.rollingOutHours)} hrs</div>
        <div className="s" style={{ fontSize: 11.5, color: "var(--ink2)", marginTop: 3 }}>added to next target</div>
      </div>
    </div>
  );
};

export const CaseloadTable: React.FC<{ period: PeriodReport }> = ({ period }) => (
  <div className={styles.tblWrap}>
    <table className={styles.caseTbl}>
      <thead>
        <tr>
          <th>Client</th>
          <th>Direct 97153</th>
          <th>Supervision 97155</th>
          <th>Ratio</th>
          <th>Caregiver 97156</th>
          <th>You delivered</th>
        </tr>
      </thead>
      <tbody>
        {period.clients.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", color: "var(--ink3)" }}>
              No caseload activity this period.
            </td>
          </tr>
        ) : (
          period.clients.map((c) => (
            <tr key={c.client}>
              <td>{c.client}</td>
              <td>{fmt(c.directHours)}</td>
              <td>{fmt(c.supervisionHours)}</td>
              <td>{c.supervisionRatio === null ? "—" : pct(c.supervisionRatio)}</td>
              <td>{fmt(c.caregiverTrainingHours)}</td>
              <td>
                {c.caregiverTrainingFlag === "OK" ? (
                  <Chip kind="good">yes</Chip>
                ) : c.caregiverTrainingFlag === "Did not deliver" ? (
                  <Chip kind="warn">no</Chip>
                ) : (
                  <span style={{ color: "var(--ink3)" }}>—</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

interface ITip {
  html: JSX.Element;
  x: number;
  y: number;
}

export const WeeklyChart: React.FC<{ report: BcbaReport; period: PeriodReport }> = ({ report, period }) => {
  const [tip, setTip] = React.useState<ITip | null>(null);

  const weeks = report.weekly.filter((w) =>
    period.periodKind === "all" ? true : period.months.indexOf(monthOf(w.weekStart)) >= 0
  );
  if (weeks.length === 0) return <p className={styles.hint}>No sessions in this period.</p>;

  const reqH = period.effectiveRequiredHours;
  const target = reqH !== null ? reqH / weeks.length : null;
  const maxV = weeks.reduce((m, w) => Math.max(m, w.billableHours), target || 0);
  const scale = Math.max(maxV * 1.15, 1);

  const step = niceStep(scale);
  const gridlines: number[] = [];
  for (let y = step; y <= scale; y += step) gridlines.push(y);

  function showTip(e: React.MouseEvent, w: typeof weeks[0]): void {
    setTip({
      x: e.clientX,
      y: e.clientY,
      html: (
        <>
          <div className={styles.hd}>{w.weekKey} · week of {w.weekStart}</div>
          {tipRow("Billable", `${fmt(w.billableHours)} h`)}
          {tipRow("Supervision (97155)", `${fmt(w.supervisionHours)} h`)}
          {tipRow("Caregiver (97156)", `${fmt(w.caregiverTrainingHours)} h`)}
          {tipRow("Telehealth", `${fmt(w.telehealthHours)} h`)}
          {tipRow("Sessions", String(w.sessionCount))}
        </>
      ),
    });
  }

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chart}>
        <div className={styles.plot}>
          {gridlines.map((y, i) => (
            <div key={i} className={styles.gridline} style={{ bottom: `${(y / scale) * 100}%` }}>
              <span className={styles.yl}>{Math.round(y)}</span>
            </div>
          ))}
          {target !== null ? (
            <div className={styles.target} style={{ bottom: `${(target / scale) * 100}%` }}>
              <span className={styles.tl}>target {fmt(target)} h/wk</span>
            </div>
          ) : null}
          <div className={styles.bars}>
            {weeks.map((w) => (
              <div key={w.weekKey} className={styles.barcol}>
                <div
                  className={styles.bar}
                  style={{ height: `${(w.billableHours / scale) * 100}%` }}
                  tabIndex={0}
                  onMouseEnter={(e) => showTip(e, w)}
                  onMouseMove={(e) => showTip(e, w)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => {
                    const r = (e.target as HTMLElement).getBoundingClientRect();
                    setTip({ x: r.left + r.width / 2, y: r.top, html: <div className={styles.hd}>{w.weekKey}: {fmt(w.billableHours)} h</div> });
                  }}
                  onBlur={() => setTip(null)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.xaxis}>
          {weeks.map((w, i) =>
            weeks.length > 10 && i % 2 !== 0 ? null : (
              <span key={w.weekKey} className={styles.xtick} style={{ left: `${((i + 0.5) / weeks.length) * 100}%` }}>
                {w.weekStart.slice(5)}
              </span>
            )
          )}
        </div>
      </div>
      {tip ? (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 232), top: Math.max(tip.y - 90, 8) }}
        >
          {tip.html}
        </div>
      ) : null}
    </div>
  );
};

function tipRow(a: string, b: string): JSX.Element {
  return (
    <div className={styles.r}>
      <span>{a}</span>
      <span>{b}</span>
    </div>
  );
}

function niceStep(scale: number): number {
  const raw = scale / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const s = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return s * pow;
}

/**
 * The full per-BCBA detail (KPIs, gates, bonus, rollover, weekly chart, caseload)
 * for one period. Reused by the single-BCBA web part and the admin overview's
 * drill-down. No data loading, no notes — pure presentation.
 */
export const ReportSections: React.FC<{
  report: BcbaReport;
  period: PeriodReport;
  onSelectPeriod: (key: string) => void;
}> = ({ report, period, onSelectPeriod }) => {
  const showRollover =
    period.periodKind === "quarter" && (period.rolledInHours > 0 || period.rollingOutHours > 0);
  return (
    <>
      <PeriodPills periods={report.periods} selected={period.periodKey} onSelect={onSelectPeriod} />
      <KpiTiles period={period} />
      <div className={styles.grid2}>
        <div className={styles.card}>
          <h2>Compliance requirements</h2>
          <p className={styles.hint}>Evaluated for the selected period against practice targets.</p>
          <ComplianceGates period={period} />
        </div>
        <div className={styles.card}>
          <h2>Quarterly bonus</h2>
          <BonusCard report={report} period={period} />
        </div>
      </div>
      {showRollover ? (
        <>
          <div className={styles.sectionHead}>
            <h2>Deficit rollover</h2>
          </div>
          <div className={styles.card}>
            <p className={styles.hint}>
              When a quarter ends below target, <b>50% of the deficit</b> is added to the next quarter&rsquo;s target.
            </p>
            <RolloverFlow period={period} />
          </div>
        </>
      ) : null}
      <div className={styles.sectionHead}>
        <h2>Week by week</h2>
        <span className={styles.eyebrow}>Billable hours personally delivered</span>
      </div>
      <div className={styles.card}>
        <WeeklyChart report={report} period={period} />
      </div>
      <div className={styles.sectionHead}>
        <h2>Caseload detail</h2>
        <span className={styles.eyebrow}>{period.label}</span>
      </div>
      <div className={styles.card}>
        <CaseloadTable period={period} />
      </div>
    </>
  );
};
