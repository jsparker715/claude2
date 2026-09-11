import { SPHttpClient, SPHttpClientResponse, ISPHttpClientOptions } from "@microsoft/sp-http";
import { BcbaReport } from "../models/report";

export interface ILoadedReport {
  itemId: number;
  report: BcbaReport;
  notes: string;
  generatedAt: string | null;
}

/**
 * Reads and writes the current user's row in the `BCBA Reports` list.
 *
 * SECURITY: this service does NOT enforce isolation. It relies on SharePoint
 * item-level permissions — each BCBA can only read/write their own item, so a
 * plain items query returns only their row even if the $filter were removed. The
 * $filter is defensive, not the control. See sharepoint-setup/ for the required
 * permission configuration.
 */
export class ReportService {
  constructor(
    private readonly spHttpClient: SPHttpClient,
    private readonly webUrl: string,
    private readonly listTitle: string
  ) {}

  private list(path: string): string {
    return `${this.webUrl}/_api/web/lists/getByTitle('${encodeURIComponent(this.listTitle)}')/${path}`;
  }

  /**
   * Load the signed-in user's report. Returns null when the user has no row
   * (e.g. not yet computed) — the caller decides whether to show sample data.
   */
  public async getMyReport(userEmail: string): Promise<ILoadedReport | null> {
    const safeEmail = userEmail.replace(/'/g, "''");
    const url = this.list(
      `items?$select=Id,ReportJson,Notes,GeneratedAt,UserEmail&$filter=UserEmail eq '${encodeURIComponent(
        safeEmail
      )}'&$top=1`
    );
    const resp: SPHttpClientResponse = await this.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) {
      throw new Error(`Could not load report (${resp.status} ${resp.statusText}).`);
    }
    const data = await resp.json();
    const item = data && data.value && data.value[0];
    if (!item) return null;

    let report: BcbaReport;
    try {
      report = JSON.parse(item.ReportJson) as BcbaReport;
    } catch (e) {
      throw new Error("Your report record is present but its data is not readable. Contact your admin.");
    }
    return {
      itemId: item.Id,
      report,
      notes: item.Notes || report.notes || "",
      generatedAt: item.GeneratedAt || report.generatedAt || null,
    };
  }

  /** Save the BCBA's notes back to their own item. */
  public async saveNotes(itemId: number, notes: string): Promise<void> {
    const url = this.list(`items(${itemId})`);
    const options: ISPHttpClientOptions = {
      headers: {
        "Content-Type": "application/json;odata=nometadata",
        "IF-MATCH": "*",
        "X-HTTP-Method": "MERGE",
      },
      body: JSON.stringify({ Notes: notes }),
    };
    const resp: SPHttpClientResponse = await this.spHttpClient.post(url, SPHttpClient.configurations.v1, options);
    if (!resp.ok && resp.status !== 204) {
      throw new Error(`Could not save your note (${resp.status} ${resp.statusText}).`);
    }
  }
}
