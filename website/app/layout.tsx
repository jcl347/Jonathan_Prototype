import type { Metadata } from "next";
import "./globals.css";

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
        <nav className="border-b border-[#2a2a2a] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
                AF
              </div>
              <div>
                <h1 className="text-lg font-semibold">ABA Fraud Detection</h1>
                <p className="text-xs text-gray-500">Network Analytics & ML Pipeline</p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="/" className="text-gray-400 hover:text-white transition">Dashboard</a>
              <a href="/providers" className="text-gray-400 hover:text-white transition">Providers</a>
              <a href="/network" className="text-gray-400 hover:text-white transition">Network</a>
              <a href="/models" className="text-gray-400 hover:text-white transition">Models</a>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-[#2a2a2a] px-6 py-6 mt-12">
          <div className="max-w-7xl mx-auto text-xs text-gray-500">
            <p className="mb-2 font-semibold text-gray-400">Methodology & Sources</p>
            <ul className="space-y-1">
              <li>Data: Synthetic dataset modeled on CMS Medicare Provider & Other Practitioners data structure</li>
              <li>Fraud patterns: Based on HHS-OIG audit findings (Indiana $56M, Colorado $77.8M, Wisconsin $18.5M improper ABA payments)</li>
              <li>Network Analysis: Louvain community detection + PageRank (Bauder & Khoshgoftaar, 2017; Zhou et al. GNN fraud detection)</li>
              <li>ML Models: XGBoost, Random Forest, Isolation Forest with Benford&apos;s Law analysis</li>
              <li>CMS CRUSH Initiative (Feb 2026): AI-based &quot;detect and deploy&quot; strategy for Medicare/Medicaid fraud</li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
