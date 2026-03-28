import type { Metadata } from "next";
import "./globals.css";
import { DatasetProvider } from "./dataset-context";
import { Nav } from "./nav";
import { ErrorBoundary } from "./error-boundary";

export const metadata: Metadata = {
  title: "ABA Therapy Fraud Detection Dashboard",
  description: "Network analytics and ML-based fraud detection for ABA therapy providers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <DatasetProvider>
            <Nav />
            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
            <footer className="border-t border-[#2a2a2a] px-6 py-6 mt-12">
              <div className="max-w-7xl mx-auto text-xs text-gray-500">
                <p className="mb-2 font-semibold text-gray-400">Methodology & Sources</p>
                <ul className="space-y-1">
                  <li>Data: Synthetic dataset modeled on CMS Medicare Provider & Other Practitioners data structure</li>
                  <li>LEIE: Real exclusion data from HHS Office of Inspector General (oig.hhs.gov)</li>
                  <li>Fraud patterns: Based on HHS-OIG audit findings (Indiana $56M, Colorado $77.8M, Wisconsin $18.5M, Maine $45.6M)</li>
                  <li>Network Analysis: Louvain community detection + PageRank</li>
                  <li>ML Models: XGBoost, Random Forest, Isolation Forest with Benford&apos;s Law analysis</li>
                </ul>
              </div>
            </footer>
          </DatasetProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
