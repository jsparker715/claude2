import * as React from "react";
import s from "../../bcbaCompliance/components/BcbaCompliance.module.scss";
import o from "./BcbaOverview.module.scss";
import { IBcbaOverviewProps } from "./IBcbaOverviewProps";
import { BcbaReport, PeriodReport } from "../../bcbaCompliance/models/report";
import { ReportService } from "../../bcbaCompliance/services/ReportService";
import { SAMPLE_REPORTS } from "../../bcbaCompliance/models/sampleData";
import { PeriodPills, ReportSections } from "../../bcbaCompliance/components/parts";
import { fmt, money, pct } from "../../bcbaCompliance/components/format";

interface IState {
  loading: boolean;
  error: string | null;
  reports: BcbaReport[];
  usingSample: boolean;
  selectedPeriod: string | null;
  onlyAttention: boolean;
  detailBcba: string | null;
  detailPeriod: string | null;
}

export default class BcbaOverview extends React.Component<IBcbaOverviewProps, IState> {
  private service: ReportService;

  constructor(props: IBcbaOverviewProps) {
    super(props);
    this.service = new ReportService(props.spHttpClient, props.webUrl, props.listTitle);
    this.state = {
      loading: true,
      error: null,
      reports: [],
      usingSample: false,
      selectedPeriod: null,
      onlyAttention: false,
      detailBcba: null,
      detailPeriod: null,
    };
  }

  public componentDidMount(): void {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      const loaded = await this.service.getAllReports();
      if (loaded.length > 0) {
        this.setState({ loading: false, reports: loaded.map((l) => l.report), usingSample: false, selectedPeriod: null });
      } else if (this.props.showSampleWhenEmpty) {
        this.setState({ loading: false, reports: SAMPLE_REPORTS, usingSample: true, selectedPeriod: null });
      } else {
        this.setState({ loading: false, reports: [] });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (this.props.showSampleWhenEmpty) {
        this.setState({ loading: false, reports: SAMPLE_REPORTS, usingSample: true, selectedPeriod: null });
        // eslint-disable-next-line no-console
        console.warn("[BCBA Overview] showing sample data:", msg);
      } else {
        this.setState({ loading: false, error: msg });
      }
    }
  }

  /** The period list to offer — from whichever report covers the most periods. */
  private canonicalPeriods(): PeriodReport[] {
    let best: BcbaReport | null = null;
    for (const r of this.state.reports) {
      if (!best || r.periods.length > best.periods.length) best = r;
    }
    return best ? best.periods : [];
  }

  private defaultPeriodKey(): string | null {
    const ps = this.canonicalPeriods();
    const quarters = ps.filter((p) => p.periodKind === "quarter");
    if (quarters.length) return quarters[quarters.length - 1].periodKey;
    return ps.length ? ps[ps.length - 1].periodKey : null;
  }

  private currentPeriodKey(): string | null {
    return this.state.selectedPeriod || this.defaultPeriodKey();
  }

  private findPeriod(report: BcbaReport, key: string | null): PeriodReport | null {
    if (!key) return null;
    return report.periods.filter((p) => p.periodKey === key)[0] || null;
  }

  private needsAttention(p: PeriodReport): boolean {
    return !p.supervisionRatioCheck.met || !p.telehealthCheck.met || !p.caregiverTrainingCheck.met;
  }

  private renderMetricCell(value: string, met: boolean): JSX.Element {
    return <td style={met ? undefined : { color: "var(--bad)", fontWeight: 600 }}>{value}</td>;
  }

  private renderOverview(): React.ReactElement {
    const key = this.currentPeriodKey();
    const periods = this.canonicalPeriods();
    const rows = this.state.reports
      .map((r) => ({ report: r, period: this.findPeriod(r, key) }))
      .filter((x) => (this.state.onlyAttention ? x.period && this.needsAttention(x.period) : true))
      .sort((a, b) => a.report.bcba.localeCompare(b.report.bcba));

    // Summary strip numbers for the selected period.
    let attention = 0;
    let underTarget = 0;
    let totalBonus = 0;
    let totalBillable = 0;
    let totalTarget = 0;
    for (const r of this.state.reports) {
      const p = this.findPeriod(r, key);
      if (!p) continue;
      if (this.needsAttention(p)) attention++;
      if (p.variance !== null && p.variance < 0) underTarget++;
      totalBonus += p.bonus ? p.bonus.amount : 0;
      totalBillable += p.billableHours;
      if (p.effectiveRequiredHours !== null) totalTarget += p.effectiveRequiredHours;
    }
    const latest = this.state.reports
      .map((r) => r.generatedAt)
      .filter((x): x is string => !!x)
      .sort()
      .pop();

    return (
      <>
        <div className={o.head}>
          <div>
            <h1>Team compliance overview</h1>
            <div className={o.sub}>
              {this.state.reports.length} behavior analyst{this.state.reports.length === 1 ? "" : "s"}
              {latest ? ` · updated ${new Date(latest).toLocaleDateString()}` : ""}
            </div>
          </div>
        </div>

        <div className={`${s.banner}`}>
          <span>🔒</span>
          <div>
            {this.state.usingSample ? (
              <>
                <b>Sample data.</b> No live reports were found (or you don&rsquo;t have access), so example figures are
                shown. This overview shows every BCBA — keep it on an <b>admin-only page</b>.
              </>
            ) : (
              <>
                This overview shows <b>every BCBA&rsquo;s</b> numbers. Keep it on an <b>admin-only page</b> — individual
                BCBAs should use their own dashboard, not this one.
              </>
            )}
          </div>
        </div>

        <PeriodPills
          periods={periods}
          selected={key || ""}
          onSelect={(k) => this.setState({ selectedPeriod: k })}
        />

        <div className={o.strip}>
          <div className={o.stat}>
            <div className="k" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" }}>Analysts</div>
            <div className="v" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{this.state.reports.length}</div>
          </div>
          <div className={o.stat}>
            <div className="k" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" }}>Need attention</div>
            <div className="v" style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: attention ? "var(--bad)" : "var(--good)" }}>{attention}</div>
          </div>
          <div className={o.stat}>
            <div className="k" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" }}>Under target</div>
            <div className="v" style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: underTarget ? "var(--warn)" : "var(--good)" }}>{underTarget}</div>
          </div>
          <div className={o.stat}>
            <div className="k" style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" }}>Est. bonus (period)</div>
            <div className="v" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{money(totalBonus)}</div>
          </div>
        </div>

        <div className={o.toolbar}>
          <label className={o.toggle}>
            <input
              type="checkbox"
              checked={this.state.onlyAttention}
              onChange={(e) => this.setState({ onlyAttention: e.target.checked })}
            />
            Only show BCBAs needing attention
          </label>
          <span className={o.spacer} />
        </div>

        <div className={s.tblWrap}>
          <table className={s.caseTbl}>
            <thead>
              <tr>
                <th>BCBA</th>
                <th>Billable</th>
                <th>Target</th>
                <th>Variance</th>
                <th>Ratio</th>
                <th>Telehealth</th>
                <th>Families 3h</th>
                <th>Bonus</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--ink3)" }}>
                    No BCBAs to show for this period.
                  </td>
                </tr>
              ) : (
                rows.map(({ report, period }) => {
                  if (!period) {
                    return (
                      <tr key={report.bcba}>
                        <td>
                          <button className={o.nameBtn} onClick={() => this.openDetail(report.bcba)}>
                            {report.bcba}
                          </button>
                        </td>
                        <td colSpan={8} style={{ color: "var(--ink3)" }}>
                          No data this period
                        </td>
                      </tr>
                    );
                  }
                  const attn = this.needsAttention(period);
                  const sc = period.supervisionRatioCheck;
                  const tc = period.telehealthCheck;
                  const cc = period.caregiverTrainingCheck;
                  return (
                    <tr key={report.bcba} className={attn ? o.rowAttention : undefined}>
                      <td>
                        <button className={o.nameBtn} onClick={() => this.openDetail(report.bcba)}>
                          {report.bcba}
                        </button>
                      </td>
                      <td>{fmt(period.billableHours, 0)}</td>
                      <td>{period.effectiveRequiredHours === null ? "—" : fmt(period.effectiveRequiredHours, 0)}</td>
                      <td style={period.variance !== null && period.variance < 0 ? { color: "var(--bad)", fontWeight: 600 } : undefined}>
                        {period.variance === null ? "—" : `${period.variance >= 0 ? "+" : ""}${fmt(period.variance, 0)}`}
                      </td>
                      {this.renderMetricCell(sc.value ? pct(sc.value) : "—", sc.met)}
                      {this.renderMetricCell(pct(tc.value), tc.met)}
                      {this.renderMetricCell(cc.target > 0 ? `${cc.value}/${cc.target}` : "—", cc.met)}
                      <td>{period.periodKind === "quarter" ? money(period.bonus.amount) : "—"}</td>
                      <td>
                        {attn ? (
                          <span className={`${s.chip} ${s.cWarn}`}>
                            <span className={s.dot} /> review
                          </span>
                        ) : (
                          <span className={`${s.chip} ${s.cGood}`}>
                            <span className={s.dot} /> on track
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              {rows.length > 0 ? (
                <tr className={o.totalRow}>
                  <td>All ({rows.length})</td>
                  <td>{fmt(totalBillable, 0)}</td>
                  <td>{fmt(totalTarget, 0)}</td>
                  <td>{fmt(totalBillable - totalTarget, 0)}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{money(totalBonus)}</td>
                  <td>—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  private openDetail(bcba: string): void {
    this.setState({ detailBcba: bcba, detailPeriod: this.currentPeriodKey() });
  }

  private renderDetail(report: BcbaReport): React.ReactElement {
    const key = this.state.detailPeriod || this.currentPeriodKey();
    const period = this.findPeriod(report, key) || report.periods[report.periods.length - 1];
    return (
      <>
        <button className={o.backBtn} onClick={() => this.setState({ detailBcba: null })}>
          ← Back to overview
        </button>
        <div className={o.detailName}>{report.bcba}</div>
        {report.email ? <div className={o.detailEmail}>{report.email}</div> : null}
        <div style={{ height: 12 }} />
        <ReportSections report={report} period={period} onSelectPeriod={(k) => this.setState({ detailPeriod: k })} />
      </>
    );
  }

  public render(): React.ReactElement {
    const rootCls = this.props.isDarkTheme ? `${s.root} ${s.dark}` : s.root;
    if (this.state.loading) {
      return (
        <div className={rootCls}>
          <div className={s.state}>Loading team overview…</div>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div className={rootCls}>
          <div className={`${s.state} ${s.stateBad}`}>{this.state.error}</div>
        </div>
      );
    }
    if (this.state.reports.length === 0) {
      return (
        <div className={rootCls}>
          <div className={s.state}>No reports found. They appear after the monthly flow has run.</div>
        </div>
      );
    }
    const detail = this.state.detailBcba
      ? this.state.reports.filter((r) => r.bcba === this.state.detailBcba)[0]
      : null;
    return <div className={rootCls}>{detail ? this.renderDetail(detail) : this.renderOverview()}</div>;
  }
}
