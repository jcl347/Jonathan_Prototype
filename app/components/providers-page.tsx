"use client";

import { useEffect, useState } from "react";
import { ScoreBar } from "./charts";

interface Provider {
  provider_id: string; provider_name: string; state: string; credential: string;
  entity_type: string; years_in_practice: number; ensemble_score: number;
  xgb_score: number; rf_score: number; iso_score: number; risk_level: string;
  is_actual_fraud: boolean; total_claims: number; total_billed: number;
  unique_patients: number; high_reimb_ratio: number; weekend_ratio: number;
  school_hours_ratio: number; billed_to_allowed_ratio: number;
  claims_per_patient: number; benfords_deviation: number; community_id: number;
  community_size: number; pagerank: number; weighted_degree: number;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/data/providers.json").then(r => r.ok ? r.json() : []).then(setProviders).catch(() => {});
  }, []);

  if (!providers.length) return <div className="text-center py-20 text-gray-500">Loading providers...</div>;

  const filtered = providers
    .filter(p => filter === "all" || p.risk_level.toLowerCase() === filter)
    .filter(p => !search || p.provider_id.includes(search) || p.state.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.ensemble_score - a.ensemble_score);

  const indicators = selected ? [
    { label: "High-Reimb Code Ratio", value: selected.high_reimb_ratio, max: 0.5 },
    { label: "Weekend Billing", value: selected.weekend_ratio, max: 0.3 },
    { label: "School Hours Billing", value: selected.school_hours_ratio, max: 0.5 },
    { label: "Billed/Allowed Ratio", value: Math.max(selected.billed_to_allowed_ratio - 1, 0), max: 0.5 },
    { label: "Claims/Patient", value: selected.claims_per_patient / 30, max: 1 },
    { label: "Benford Deviation", value: selected.benfords_deviation, max: 0.3 },
  ] : [];

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Provider Analysis</h2><p className="text-sm text-gray-500">Individual provider fraud risk profiles</p></div>
      <div className="flex gap-4 items-center flex-wrap">
        <input type="text" placeholder="Search by ID or state..." value={search} onChange={e => setSearch(e.target.value)} className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm w-64" />
        <div className="flex gap-2">{["all","critical","high","medium","low"].map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f ? "bg-blue-600 text-white" : "bg-[#1a1a1a] text-gray-400"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>))}</div>
        <span className="text-xs text-gray-500">{filtered.length} providers</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2 max-h-[700px] overflow-y-auto pr-2">
          {filtered.slice(0, 50).map(p => (
            <div key={p.provider_id} onClick={() => setSelected(p)} className={`card cursor-pointer transition hover:border-blue-500/50 ${selected?.provider_id === p.provider_id ? "border-blue-500" : ""}`} style={{ padding: "0.75rem 1rem" }}>
              <div className="flex justify-between items-start"><div><p className="text-sm font-mono">{String(p.provider_id).slice(0, 14)}...</p><p className="text-xs text-gray-500">{p.state} | {p.credential}</p></div><span className={`badge badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</span></div>
              <div className="flex gap-4 mt-1 text-xs text-gray-500"><span>Score: {p.ensemble_score.toFixed(3)}</span><span>${(p.total_billed / 1000).toFixed(0)}k</span></div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-6">
              <div className="card"><div className="flex justify-between items-start"><div><h3 className="text-lg font-bold font-mono">{selected.provider_id}</h3><p className="text-sm text-gray-500">{selected.state} | {selected.credential} | {selected.entity_type} | {selected.years_in_practice} yrs</p></div><div className="text-right"><span className={`badge badge-${selected.risk_level.toLowerCase()} text-base px-4 py-1`}>{selected.risk_level} Risk</span><p className="text-2xl font-bold mt-2">{selected.ensemble_score.toFixed(4)}</p><p className="text-xs text-gray-500">Ensemble Score</p></div></div></div>
              <div className="grid grid-cols-4 gap-3">
                <div className="card text-center" style={{padding:"0.75rem"}}><p className="text-xs text-gray-500">Total Billed</p><p className="text-lg font-bold">${(selected.total_billed/1000).toFixed(1)}k</p></div>
                <div className="card text-center" style={{padding:"0.75rem"}}><p className="text-xs text-gray-500">Claims</p><p className="text-lg font-bold">{selected.total_claims}</p></div>
                <div className="card text-center" style={{padding:"0.75rem"}}><p className="text-xs text-gray-500">Patients</p><p className="text-lg font-bold">{selected.unique_patients}</p></div>
                <div className="card text-center" style={{padding:"0.75rem"}}><p className="text-xs text-gray-500">Community</p><p className="text-lg font-bold">#{selected.community_id}</p></div>
              </div>
              <div className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">Fraud Indicators</h4><div className="space-y-2">{indicators.map(ind => (<ScoreBar key={ind.label} label={ind.label} value={Math.min(ind.value / ind.max, 1)} color={ind.value / ind.max > 0.6 ? "#ef4444" : ind.value / ind.max > 0.3 ? "#f59e0b" : "#22c55e"} />))}</div></div>
              <div className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">Model Scores</h4><div className="space-y-2"><ScoreBar label="XGBoost" value={selected.xgb_score} color="#3b82f6" /><ScoreBar label="Random Forest" value={selected.rf_score} color="#22c55e" /><ScoreBar label="Isolation Forest" value={Math.min(selected.iso_score / 2, 1)} color="#f59e0b" /><ScoreBar label="Ensemble" value={selected.ensemble_score} color="#8b5cf6" /></div></div>
              <div className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">Network Position</h4><div className="grid grid-cols-3 gap-4 text-center"><div><p className="text-xs text-gray-500">PageRank</p><p className="text-lg font-mono">{selected.pagerank.toFixed(6)}</p></div><div><p className="text-xs text-gray-500">Weighted Degree</p><p className="text-lg font-mono">{selected.weighted_degree.toFixed(1)}</p></div><div><p className="text-xs text-gray-500">Community Size</p><p className="text-lg font-mono">{selected.community_size}</p></div></div></div>
            </div>
          ) : <div className="card text-center py-20"><p className="text-gray-500">Select a provider to view details</p></div>}
        </div>
      </div>
    </div>
  );
}
