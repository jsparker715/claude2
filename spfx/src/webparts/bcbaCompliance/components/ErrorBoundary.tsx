import * as React from "react";

interface IProps {
  children: React.ReactNode;
}
interface IState {
  error: Error | null;
}

/**
 * Catches render-time exceptions and shows the real message on the page, instead
 * of letting SPFx surface an opaque "Something went wrong / [object Object]".
 */
export class ErrorBoundary extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): IState {
    return { error };
  }

  public componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error("[BCBA Compliance] render error:", error);
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif", color: "#14202a" }}>
          <div style={{ fontWeight: 700, color: "#b23a30", marginBottom: 8 }}>
            The compliance dashboard hit an error while displaying.
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Give this to your administrator:
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              background: "#f5f0ef",
              border: "1px solid #e0c8c4",
              borderRadius: 8,
              padding: 12,
              color: "#5a3a36",
            }}
          >
            {this.state.error.message}
            {this.state.error.stack ? "\n\n" + this.state.error.stack : ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
