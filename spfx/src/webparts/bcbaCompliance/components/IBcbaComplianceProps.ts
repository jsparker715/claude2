import { SPHttpClient } from "@microsoft/sp-http";

export interface IBcbaComplianceProps {
  spHttpClient: SPHttpClient;
  webUrl: string;
  listTitle: string;
  showSampleWhenEmpty: boolean;
  currentUserEmail: string;
  currentUserDisplayName: string;
  isDarkTheme: boolean;
}
