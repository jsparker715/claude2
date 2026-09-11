import { SPHttpClient } from "@microsoft/sp-http";

export interface IBcbaOverviewProps {
  spHttpClient: SPHttpClient;
  webUrl: string;
  listTitle: string;
  showSampleWhenEmpty: boolean;
  isDarkTheme: boolean;
}
