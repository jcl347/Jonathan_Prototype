"use client";

import { useEffect, useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

interface Provider {
  provider_id: string;
  provider_name: string;
  state: string;
  credential: string;
  entity_type: string;
  years_in_practice: number;
  ensemble_score: number;
  xgb_score: number;
  rf_score: number;
  iso_score: number;
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
  community_size: number;
  pagerank: number;
  weighted_degree: number;
}

function ProvidersPageInner() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"ensemble_score" | "total_billed" | "total_claims">("ensemble_score");

  useEffect(() => {
    fetch("/data/providers.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setProviders)
      .catch((err) => console.error("Failed to load providers:", err));
  }, []);

  const filtered = providers
    .filter((p) => {
      if (filter === "critical") return p.risk_level === "Critical";
      if (filter === "high") return p.risk_level === "High";
      if (filter === "medium") return p.risk_level === "Medium";
      if (filter === "low") return p.risk_level === "Low";
      return true;
    })
    .filter((p) =>
      search ? p.provider_id.includes(search) || p.state.toLowerCase().includes(search.toLowerCase()) : true
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const radarData = selected
    ? [
        { indicator: "Upcoding", value: Math.min(selected.high_reimb_ratio * 100 / 0.5, 100) },
        { indicator: "Weekend", value: Math.min(selected.weekend_ratio * 100 / 0.3, 100) },
        { indicator: "School Hrs", value: Math.min(selected.school_hours_ratio * 100 / 0.5, 100) },
        { indicator: "Bill Ratio", value: Math.min((selected.billed_to_allowed_ratio - 1) * 100, 100) },
        { indicator: "Volume", value: Math.min(selected.claims_per_patient * 100 / 30, 100) },
        { indicator: "Benford", value: Math.min(selected.benfords_deviation * 100 / 0.3, 100) },
      ]
    : [];

  const modelScores = selected
    ? [
        { model: "XGBoost", score: selected.xgb_score },
        { model: "Random Forest", score: selected.rf_score },
        { model: "Isolation Forest", score: Math.min(selected.iso_score / 2, 1) },
        { model: "Ensemble", score: selected.ensemble_score },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Provider Analysis</h2>
        <p className="text-sm text-gray-500">
          Individual provider fraud risk profiles with multi-indicator analysis
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by ID or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm w-64"
        />
        <div className="flex gap-2">
          {["all", "critical", "high", "medium", "low"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f ? "bg-blue-600 text-white" : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm"
        >
          <option value="ensemble_score">Sort by Risk Score</option>
          <option value="total_billed">Sort by Total Billed</option>
          <option value="total_claims">Sort by Total Claims</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} providers</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider List */}
        <div className="lg:col-span-1 space-y-2 max-h-[700px] overflow-y-auto pr-2">
          {filtered.slice(0, 50).map((p) => (
            <div
              key={p.provider_id}
              onClick={() => setSelected(p)}
              className={`card cursor-pointer transition hover:border-blue-500/50 ${
                selected?.provider_id === p.provider_id ? "border-blue-500" : ""
              }`}
              style={{ padding: "0.75rem 1rem" }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-mono">{p.provider_id.slice(0, 14)}...</p>
                  <p className="text-xs text-gray-500">{p.state} | {p.credential} | {p.entity_type}</p>
                </div>
                <span className={`badge badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span>Score: {p.ensemble_score.toFixed(3)}</span>
                <span>${(p.total_billed / 1000).toFixed(0)}k billed</span>
                <span>{p.total_claims} claims</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold font-mono">{selected.provider_id}</h3>
                    <p className="text-sm text-gray-500">
                      {selected.state} | {selected.credential} | {selected.entity_type} |{" "}
                      {selected.years_in_practice} yrs
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`badge badge-${selected.risk_level.toLowerCase()} text-base px-4 py-1`}>
                      {selected.risk_level} Risk
                    </span>
                    <p className="text-2xl font-bold mt-2">{selected.ensemble_score.toFixed(4)}</p>
                    <p className="text-xs text-gray-500">Ensemble Score</p>
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3">
                <div className="card text-center" style={{ padding: "0.75rem" }}>
                  <p className="text-xs text-gray-500">Total Billed</p>
                  <p className="text-lg font-bold">${(selected.total_billed / 1000).toFixed(1)}k</p>
                </div>
                <div className="card text-center" style={{ padding: "0.75rem" }}>
                  <p className="text-xs text-gray-500">Claims</p>
                  <p className="text-lg font-bold">{selected.total_claims}</p>
                </div>
                <div className="card text-center" style={{ padding: "0.75rem" }}>
                  <p className="text-xs text-gray-500">Patients</p>
                  <p className="text-lg font-bold">{selected.unique_patients}</p>
                </div>
                <div className="card text-center" style={{ padding: "0.75rem" }}>
                  <p className="text-xs text-gray-500">Community</p>
                  <p className="text-lg font-bold">#{selected.community_id}</p>
                  <p className="text-xs text-gray-600">Size: {selected.community_size}</p>
                </div>
              </div>

              {/* Fraud Indicator Radar */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Fraud Indicator Profile</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="indicator" tick={{ fill: "#999", fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: "#666", fontSize: 10 }} domain={[0, 100]} />
                    <Radar
                      name="Risk Indicators"
                      dataKey="value"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div>
                    <span className="text-gray-500">High-Reimb Code Ratio:</span>{" "}
                    <span className="font-mono">{(selected.high_reimb_ratio * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Weekend Billing:</span>{" "}
                    <span className="font-mono">{(selected.weekend_ratio * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">School Hours:</span>{" "}
                    <span className="font-mono">{(selected.school_hours_ratio * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bill/Allowed Ratio:</span>{" "}
                    <span className="font-mono">{selected.billed_to_allowed_ratio.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Claims/Patient:</span>{" "}
                    <span className="font-mono">{selected.claims_per_patient.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Benford Deviation:</span>{" "}
                    <span className="font-mono">{selected.benfords_deviation.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Model Scores */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Model Scores</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={modelScores} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" domain={[0, 1]} tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis type="category" dataKey="model" tick={{ fill: "#999", fontSize: 11 }} width={120} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
                      formatter={(v) => Number(v).toFixed(4)}
                    />
                    <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Network Info */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Network Position</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">PageRank</p>
                    <p className="text-lg font-mono">{selected.pagerank.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Weighted Degree</p>
                    <p className="text-lg font-mono">{selected.weighted_degree.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Community Size</p>
                    <p className="text-lg font-mono">{selected.community_size}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-20">
              <p className="text-gray-500">Select a provider to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  return <ProvidersPageInner />;
}
