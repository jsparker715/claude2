import * as React from "react";
import * as ReactDom from "react-dom";
import { Version } from "@microsoft/sp-core-library";
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
} from "@microsoft/sp-property-pane";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { IReadonlyTheme } from "@microsoft/sp-component-base";

import * as strings from "BcbaComplianceWebPartStrings";
import BcbaCompliance from "./components/BcbaCompliance";
import { IBcbaComplianceProps } from "./components/IBcbaComplianceProps";
import { ErrorBoundary } from "./components/ErrorBoundary";

export interface IBcbaComplianceWebPartProps {
  listTitle: string;
  showSampleWhenEmpty: boolean;
}

export default class BcbaComplianceWebPart extends BaseClientSideWebPart<IBcbaComplianceWebPartProps> {
  private isDarkTheme = false;

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    this.isDarkTheme = !!(currentTheme && currentTheme.isInverted);
    this.render();
  }

  public render(): void {
    try {
      const inner: React.ReactElement<IBcbaComplianceProps> = React.createElement(BcbaCompliance, {
        spHttpClient: this.context.spHttpClient,
        webUrl: this.context.pageContext.web.absoluteUrl,
        listTitle: this.properties.listTitle || "BCBA Reports",
        showSampleWhenEmpty: this.properties.showSampleWhenEmpty !== false,
        currentUserEmail: this.context.pageContext.user.email || this.context.pageContext.user.loginName,
        currentUserDisplayName: this.context.pageContext.user.displayName,
        isDarkTheme: this.isDarkTheme,
      });
      const element = React.createElement(ErrorBoundary, undefined, inner);
      ReactDom.render(element, this.domElement);
    } catch (e) {
      // Never let SPFx surface an opaque "[object Object]" — show the reason.
      const msg = e instanceof Error ? `${e.message}\n\n${e.stack || ""}` : String(e);
      this.domElement.innerHTML =
        '<div style="padding:16px;font-family:Segoe UI,sans-serif;color:#b23a30">' +
        "<b>The compliance dashboard could not start.</b>" +
        '<pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;color:#5a3a36;background:#f5f0ef;border:1px solid #e0c8c4;border-radius:8px;padding:12px;margin-top:8px"></pre></div>';
      const pre = this.domElement.querySelector("pre");
      if (pre) pre.textContent = msg;
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.DataSourceGroupName,
              groupFields: [
                PropertyPaneTextField("listTitle", { label: strings.ListTitleFieldLabel }),
                PropertyPaneToggle("showSampleWhenEmpty", { label: strings.ShowSampleFieldLabel }),
              ],
            },
          ],
        },
      ],
    };
  }
}
