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
    const element: React.ReactElement<IBcbaComplianceProps> = React.createElement(BcbaCompliance, {
      spHttpClient: this.context.spHttpClient,
      webUrl: this.context.pageContext.web.absoluteUrl,
      listTitle: this.properties.listTitle || "BCBA Reports",
      showSampleWhenEmpty: this.properties.showSampleWhenEmpty !== false,
      currentUserEmail: this.context.pageContext.user.email || this.context.pageContext.user.loginName,
      currentUserDisplayName: this.context.pageContext.user.displayName,
      isDarkTheme: this.isDarkTheme,
    });
    ReactDom.render(element, this.domElement);
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
