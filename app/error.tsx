"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error Boundary:", error);
  }, [error]);

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "monospace" }}>
      <h2 style={{ color: "#ef4444", fontSize: "1.5rem", marginBottom: "1rem" }}>
        Application Error
      </h2>
      <div style={{ background: "#1a1a1a", padding: "1rem", borderRadius: "8px", border: "1px solid #ef444433", marginBottom: "1rem" }}>
        <p style={{ color: "#f59e0b", fontWeight: "bold", marginBottom: "0.5rem" }}>
          {error.name}: {error.message}
        </p>
        {error.digest && (
          <p style={{ color: "#666", fontSize: "12px" }}>Digest: {error.digest}</p>
        )}
      </div>
      <details style={{ background: "#1a1a1a", padding: "1rem", borderRadius: "8px", border: "1px solid #333", marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", color: "#999" }}>Stack Trace</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "#888", marginTop: "0.5rem", overflow: "auto" }}>
          {error.stack}
        </pre>
      </details>
      <button
        onClick={reset}
        style={{ padding: "0.5rem 1rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
      >
        Try Again
      </button>
    </div>
  );
}
