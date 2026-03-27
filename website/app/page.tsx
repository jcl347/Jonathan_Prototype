"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";

interface Provider {
  provider_id: string;
  provider_name: string;
  state: string;
  credential: string;
  ensemble_score: number;
  risk_level: string;
  is_actual_fraud: boolean;
  total_claims: number;
  total_billed: number;
  unique_patients: number;
  high_reimb_ratio: number;
  weekend_ratio: number;
  school_hours_ratio: number;
  billed_to_allowed_ratio: number;
  claims_per_patient: number;
  benfords_deviation: number;
  community_id: number;
  pagerank: number;
}

interface ModelPerformance {
  xgboost: { cv_auc_mean: number; cv_auc_std: number; classification_report: Record<string, unknown> };
  random_forest: { cv_auc_mean: number; cv_auc_std: number; classification_report: Record<string, unknown> };
  isolation_forest: { auc: number; classification_report: Record<string, unknown> };
}

interface ClaimsDist {
  by_code: Array<{ hcpcs_code: string; count: number; avg_billed: number; total_billed: number }>;
  fraud_vs_legit: {
    fraud: { avg_billed: number; avg_units: number; total_billed: number };
    legit: { avg_billed: number; avg_units: number; total_billed: number };
  };
}

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#eab308",
  Low: "#22c55e",
};

export default function Dashboard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [claimsDist, setClaimsDist] = useState<ClaimsDist | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/providers.json").then((r) => r.json()),
      fetch("/data/model_performance.json").then((r) => r.json()),
      fetch("/data/claims_distribution.json").then((r) => r.json()),
    ]).then(([p, m, c]) => {
      setProviders(p);
      setPerformance(m);
      setClaimsDist(c);
    });
  }, []);

  if (!providers.length || !performance || !claimsDist) {
    return <div className="text-center py-20 text-gray-500">Loading dashboard...</div>;
  }

  const riskCounts = providers.reduce(
    (acc, p) => {
      acc[p.risk_level] = (acc[p.risk_level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const riskPieData = Object.entries(riskCounts).map(([name, value]) => ({
    name,
    value,
    color: RISK_COLORS[name] || "#666",
  }));

  const topRisk = providers.slice(0, 10);
  const totalFlagged = providers.filter((p) => p.risk_level === "Critical" || p.risk_level === "High").length;
  const totalBilledFraud = providers
    .filter((p) => p.risk_level === "Critical" || p.risk_level === "High")
    .reduce((sum, p) => sum + p.total_billed, 0);

  const scatterData = providers.map((p) => ({
    x: p.total_billed,
    y: p.ensemble_score,
    z: p.total_claims,
    name: p.provider_id,
    risk: p.risk_level,
    fraud: p.is_actual_fraud,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">ABA Therapy Fraud Detection Dashboard</h2>
        <p className="text-gray-500 text-sm">
          Multi-model ensemble analysis of {providers.length} providers using network analytics,
          XGBoost, Random Forest, and Isolation Forest
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Providers</p>
          <p className="text-3xl font-bold mt-1">{providers.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Flagged (High/Critical)</p>
          <p className="text-3xl font-bold mt-1 text-red-400">{totalFlagged}</p>
          <p className="text-xs text-gray-500">{((totalFlagged / providers.length) * 100).toFixed(1)}% of providers</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Suspicious Billing</p>
          <p className="text-3xl font-bold mt-1 text-amber-400">${(totalBilledFraud / 1e6).toFixed(2)}M</p>
          <p className="text-xs text-gray-500">from flagged providers</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Best Model AUC</p>
          <p className="text-3xl font-bold mt-1 text-blue-400">
            {Math.max(performance.xgboost.cv_auc_mean, performance.random_forest.cv_auc_mean).toFixed(3)}
          </p>
          <p className="text-xs text-gray-500">5-fold cross-validated</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Provider Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={riskPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {riskPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Claims by Code */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Claims by HCPCS Code</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={claimsDist.by_code}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="hcpcs_code" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis tick={{ fill: "#999", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
                formatter={(value) => Number(value).toLocaleString()}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scatter: Billed Amount vs Risk Score */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">
          Provider Risk Score vs Total Billed Amount
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="x"
              name="Total Billed"
              tick={{ fill: "#999", fontSize: 11 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Risk Score"
              tick={{ fill: "#999", fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[20, 200]} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
              formatter={(value, name) => {
                const v = Number(value);
                return name === "Total Billed" ? `$${v.toLocaleString()}` : v.toFixed(4);
              }}
            />
            <Legend />
            <Scatter
              name="Legitimate"
              data={scatterData.filter((d) => !d.fraud)}
              fill="#22c55e"
              fillOpacity={0.6}
            />
            <Scatter
              name="Fraudulent"
              data={scatterData.filter((d) => d.fraud)}
              fill="#ef4444"
              fillOpacity={0.8}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Fraud vs Legit Comparison */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Fraud vs Legitimate Billing Comparison</h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-xs text-gray-500">Avg Billed per Claim</p>
            <p className="text-lg font-bold text-red-400">${claimsDist.fraud_vs_legit.fraud.avg_billed}</p>
            <p className="text-xs text-gray-600">Fraud</p>
            <p className="text-lg font-bold text-green-400 mt-2">${claimsDist.fraud_vs_legit.legit.avg_billed}</p>
            <p className="text-xs text-gray-600">Legitimate</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Units per Claim</p>
            <p className="text-lg font-bold text-red-400">{claimsDist.fraud_vs_legit.fraud.avg_units}</p>
            <p className="text-xs text-gray-600">Fraud</p>
            <p className="text-lg font-bold text-green-400 mt-2">{claimsDist.fraud_vs_legit.legit.avg_units}</p>
            <p className="text-xs text-gray-600">Legitimate</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Billed</p>
            <p className="text-lg font-bold text-red-400">${(claimsDist.fraud_vs_legit.fraud.total_billed / 1e6).toFixed(2)}M</p>
            <p className="text-xs text-gray-600">Fraud</p>
            <p className="text-lg font-bold text-green-400 mt-2">${(claimsDist.fraud_vs_legit.legit.total_billed / 1e6).toFixed(2)}M</p>
            <p className="text-xs text-gray-600">Legitimate</p>
          </div>
        </div>
      </div>

      {/* Top Risk Providers Table */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Top 10 Highest Risk Providers</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]">
                <th className="text-left py-2 px-2">Provider</th>
                <th className="text-left py-2 px-2">State</th>
                <th className="text-left py-2 px-2">Credential</th>
                <th className="text-right py-2 px-2">Risk Score</th>
                <th className="text-right py-2 px-2">Total Billed</th>
                <th className="text-right py-2 px-2">Claims</th>
                <th className="text-center py-2 px-2">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {topRisk.map((p) => (
                <tr key={p.provider_id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2 px-2">
                    <a href={`/providers?id=${p.provider_id}`} className="text-blue-400 hover:underline">
                      {p.provider_id.slice(0, 12)}...
                    </a>
                  </td>
                  <td className="py-2 px-2">{p.state}</td>
                  <td className="py-2 px-2">{p.credential}</td>
                  <td className="py-2 px-2 text-right font-mono">{p.ensemble_score.toFixed(4)}</td>
                  <td className="py-2 px-2 text-right">${p.total_billed.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">{p.total_claims}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`badge badge-${p.risk_level.toLowerCase()}`}>
                      {p.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          <a href="/providers" className="text-blue-400 hover:underline">View all providers →</a>
        </p>
      </div>

      {/* Model Performance Summary */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Model Performance (5-Fold CV)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg">
            <p className="text-xs text-gray-500">XGBoost</p>
            <p className="text-2xl font-bold text-blue-400">{performance.xgboost.cv_auc_mean.toFixed(3)}</p>
            <p className="text-xs text-gray-600">AUC +/- {performance.xgboost.cv_auc_std.toFixed(3)}</p>
          </div>
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg">
            <p className="text-xs text-gray-500">Random Forest</p>
            <p className="text-2xl font-bold text-green-400">{performance.random_forest.cv_auc_mean.toFixed(3)}</p>
            <p className="text-xs text-gray-600">AUC +/- {performance.random_forest.cv_auc_std.toFixed(3)}</p>
          </div>
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg">
            <p className="text-xs text-gray-500">Isolation Forest</p>
            <p className="text-2xl font-bold text-amber-400">{performance.isolation_forest.auc.toFixed(3)}</p>
            <p className="text-xs text-gray-600">AUC (unsupervised)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
