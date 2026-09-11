import * as React from "react";
import styles from "./BcbaCompliance.module.scss";
import { IBcbaComplianceProps } from "./IBcbaComplianceProps";
import { BcbaReport, PeriodReport } from "../models/report";
import { ReportService, ILoadedReport } from "../services/ReportService";
import { SAMPLE_REPORTS } from "../models/sampleData";
import { PeriodPills, KpiTiles, ComplianceGates, BonusCard, RolloverFlow, CaseloadTable, WeeklyChart } from "./parts";

interface IState {
  loading: boolean;
  error: string | null;
  report: BcbaReport | null;
  itemId: number | null;
  usingSample: boolean;
  generatedAt: string | null;
  selectedPeriod: string | null;
  notesDraft: string;
  notesSaving: boolean;
  notesSavedAt: number | null;
}

export default class BcbaCompliance extends React.Component<IBcbaComplianceProps, IState> {
  private service: ReportService;

  constructor(props: IBcbaComplianceProps) {
    super(props);
    this.service = new ReportService(props.spHttpClient, props.webUrl, props.listTitle);
    this.state = {
      loading: true,
      error: null,
      report: null,
      itemId: null,
      usingSample: false,
      generatedAt: null,
      selectedPeriod: null,
      notesDraft: "",
      notesSaving: false,
      notesSavedAt: null,
    };
  }

  public componentDidMount(): void {
    this.load();
  }

  private pickSample(): BcbaReport {
    const email = (this.props.currentUserEmail || "").toLowerCase();
    const match = SAMPLE_REPORTS.filter((r) => (r.email || "").toLowerCase() === email)[0];
    return match || SAMPLE_REPORTS[0];
  }

  private useSample(reason: string | null): void {
    const report = this.pickSample();
    this.setState({
      loading: false,
      error: null,
      report,
      itemId: null,
      usingSample: true,
      generatedAt: null,
      selectedPeriod: this.defaultPeriod(report),
      notesDraft: report.notes || "",
      // reason kept only for potential debugging; not surfaced beyond the sample banner
    });
    if (reason) {
      // eslint-disable-next-line no-console
      console.warn("[BCBA Compliance] Showing sample data:", reason);
    }
  }

  private applyLoaded(loaded: ILoadedReport): void {
    this.setState({
      loading: false,
      error: null,
      report: loaded.report,
      itemId: loaded.itemId,
      usingSample: false,
      generatedAt: loaded.generatedAt,
      selectedPeriod: this.defaultPeriod(loaded.report),
      notesDraft: loaded.notes,
    });
  }

  private async load(): Promise<void> {
    this.setState({ loading: true, error: null });
    try {
      const loaded = await this.service.getMyReport(this.props.currentUserEmail);
      if (loaded) {
        this.applyLoaded(loaded);
      } else if (this.props.showSampleWhenEmpty) {
        this.useSample("No report row found for this user.");
      } else {
        this.setState({ loading: false, report: null, error: null });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (this.props.showSampleWhenEmpty) {
        this.useSample(msg);
      } else {
        this.setState({ loading: false, error: msg });
      }
    }
  }

  private defaultPeriod(report: BcbaReport): string | null {
    const quarters = report.periods.filter((p) => p.periodKind === "quarter");
    if (quarters.length) return quarters[quarters.length - 1].periodKey;
    return report.periods.length ? report.periods[report.periods.length - 1].periodKey : null;
  }

  private currentPeriod(): PeriodReport | null {
    const { report, selectedPeriod } = this.state;
    if (!report) return null;
    return report.periods.filter((p) => p.periodKey === selectedPeriod)[0] || report.periods[report.periods.length - 1] || null;
  }

  private async saveNotes(): Promise<void> {
    const { itemId, notesDraft, usingSample } = this.state;
    if (usingSample || itemId === null) {
      this.setState({ notesSavedAt: Date.now() });
      return;
    }
    this.setState({ notesSaving: true });
    try {
      await this.service.saveNotes(itemId, notesDraft);
      this.setState({ notesSaving: false, notesSavedAt: Date.now() });
    } catch (e) {
      this.setState({ notesSaving: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  public render(): React.ReactElement {
    const rootCls = this.props.isDarkTheme ? `${styles.root} ${styles.dark}` : styles.root;
    const { loading, error, report, usingSample, generatedAt, notesDraft, notesSaving, notesSavedAt } = this.state;

    if (loading) {
      return (
        <div className={rootCls}>
          <div className={styles.state}>Loading your compliance report…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className={rootCls}>
          <div className={`${styles.state} ${styles.stateBad}`}>{error}</div>
        </div>
      );
    }
    if (!report) {
      return (
        <div className={rootCls}>
          <div className={styles.state}>
            No report has been published for you yet. It’s generated when your admin uploads the month’s billing and PTO files.
          </div>
        </div>
      );
    }

    const period = this.currentPeriod();
    if (!period) {
      return (
        <div className={rootCls}>
          <div className={styles.state}>Your report has no reporting periods yet.</div>
        </div>
      );
    }

    const showRollover = period.periodKind === "quarter" && (period.rolledInHours > 0 || period.rollingOutHours > 0);

    return (
      <div className={rootCls}>
        {usingSample ? (
          <div className={`${styles.banner} ${styles.bannerWarn}`}>
            <span>⚠️</span>
            <div>
              <b>Sample data.</b> No published report was found for <b>{this.props.currentUserEmail}</b>, so example
              figures are shown. Your real numbers appear once the monthly job has run and the “BCBA&nbsp;Reports” list
              is in place.
            </div>
          </div>
        ) : null}

        <div className={styles.person}>
          <h1>{report.bcba}</h1>
          {report.email ? <span className={styles.email}>{report.email}</span> : null}
          {generatedAt ? <span className={styles.generated}>Updated {new Date(generatedAt).toLocaleDateString()}</span> : null}
        </div>

        <PeriodPills
          periods={report.periods}
          selected={period.periodKey}
          onSelect={(key) => this.setState({ selectedPeriod: key })}
        />

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
                When a quarter ends below target, <b>50% of the deficit</b> is added to the next quarter’s target. The
                other half is forgiven.
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
          <p className={styles.hint}>
            Client hours are totals across all providers; the ratio and the caregiver-training flag are what your
            requirements track.
          </p>
          <CaseloadTable period={period} />
        </div>

        <div className={styles.sectionHead}>
          <h2>Your notes</h2>
          <span className={styles.eyebrow}>Private to you</span>
        </div>
        <div className={`${styles.card} ${styles.notes}`}>
          <p className={styles.hint}>
            Anything you want to flag for your clinical manager — questions, context on a slow month, planned catch-up.
          </p>
          <textarea
            value={notesDraft}
            placeholder="Add a note…"
            onChange={(e) => this.setState({ notesDraft: e.target.value, notesSavedAt: null })}
          />
          <div className={styles.notesRow}>
            <button className={styles.btn} disabled={notesSaving} onClick={() => this.saveNotes()}>
              {notesSaving ? "Saving…" : "Save note"}
            </button>
            {notesSavedAt ? <span className={styles.saved}>Saved ✓{usingSample ? " (sample — not persisted)" : ""}</span> : null}
          </div>
        </div>

        <div className={styles.footer}>
          <b>Rules applied:</b> supervision ratio 10–20%, telehealth ≤ 50% (approved clients exempt), 3 caregiver-training
          hrs/quarter, 50% deficit rollover, and a bonus of $40/hr over requirement plus $20/hr for caregiver training
          above 3 hrs/quarter when the billable minimum is met.
        </div>
      </div>
    );
  }
}
