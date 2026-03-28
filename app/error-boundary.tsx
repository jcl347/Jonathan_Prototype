"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const info = `${error.name}: ${error.message}\n${error.stack}\nComponent Stack: ${errorInfo.componentStack}`;
    this.setState({ errorInfo: info });
    console.error("ErrorBoundary caught:", info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "monospace" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "1rem" }}>Client-Side Error Caught</h2>
          <div style={{ background: "#1a1a1a", padding: "1rem", borderRadius: "8px", border: "1px solid #333", marginBottom: "1rem" }}>
            <p style={{ color: "#f59e0b", fontWeight: "bold" }}>{this.state.error?.name}: {this.state.error?.message}</p>
          </div>
          <details style={{ background: "#1a1a1a", padding: "1rem", borderRadius: "8px", border: "1px solid #333" }}>
            <summary style={{ cursor: "pointer", color: "#999" }}>Full Stack Trace</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "#888", marginTop: "0.5rem", overflow: "auto" }}>
              {this.state.errorInfo || this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: "" })}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
