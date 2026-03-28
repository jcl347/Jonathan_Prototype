"use client";

import { useEffect, useState } from "react";
import { useDataset } from "../dataset-context";
import { BarChart, DonutChart, LineChart, StatCard, ScoreBar } from "./charts";

interface Provider {
  provider_id: string; provider_name: string; state: string; credential: string;
  ensemble_score: number; risk_level: string; is_actual_fraud: boolean;
  total_claims: number; total_billed: number; unique_patients: number;
}
interface ModelPerformance {
  xgboost: { cv_auc_mean: number; cv_auc_std: number };
  random_forest: { cv_auc_mean: number; cv_auc_std: number };
  isolation_forest: { auc: number };
}
interface ClaimsDist {
  by_code: Array<{ hcpcs_code: string; count: number }>;
  fraud_vs_legit: { fraud: { avg_billed: number; avg_units: number; total_billed: number }; legit: { avg_billed: number; avg_units: number; total_billed: number } };
}
interface LeieData {
  metadata: { dataset: string; source: string; url: string; total_records: number; aba_related: number; states_represented: number; date_range: string };
  providers: Array<Record<string, unknown>>;
  aba_by_year: Array<{ excl_year: number; count: number }>;
  aba_by_state: Array<{ STATE: string; count: number }>;
  aba_by_type: Array<{ excl_type_desc: string; count: number }>;
  all_by_year: Array<{ excl_year: number; count: number }>;
  specialty_dist: Array<{ specialty: string; count: number }>;
}

const RISK_COLORS: Record<string, string> = { Critical: "#ef4444", High: "#f59e0b", Medium: "#eab308", Low: "#22c55e" };

function SyntheticDashboard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [claimsDist, setClaimsDist] = useState<ClaimsDist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/providers.json").then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
      fetch("/data/model_performance.json").then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
      fetch("/data/claims_distribution.json").then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    ]).then(([p, m, c]) => { setProviders(p); setPerformance(m); setClaimsDist(c); }).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="text-center py-20"><p className="text-red-400">Failed to load: {error}</p></div>;
  if (!providers.length || !performance || !claimsDist) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  const riskCounts = providers.reduce((a, p) => { a[p.risk_level] = (a[p.risk_level] || 0) + 1; return a; }, {} as Record<string, number>);
  const topRisk = [...providers].sort((a, b) => b.ensemble_score - a.ensemble_score).slice(0, 10);
  const totalFlagged = providers.filter(p => p.risk_level === "Critical" || p.risk_level === "High").length;
  const totalBilledFraud = providers.filter(p => p.risk_level === "Critical" || p.risk_level === "High").reduce((s, p) => s + p.total_billed, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Synthetic ABA Fraud Dataset</h2>
        <p className="text-gray-500 text-sm">ML-generated: {providers.length} providers, ~9.5% fraud rate. Modeled on OIG audit findings.</p>
        <p className="text-xs text-amber-500 mt-1">Reliability: 6/10 (training) | Source: Generated</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Providers" value={providers.length} />
        <StatCard label="Flagged (High/Critical)" value={totalFlagged} sub={`${((totalFlagged / providers.length) * 100).toFixed(1)}%`} color="text-red-400" />
        <StatCard label="Suspicious Billing" value={`$${(totalBilledFraud / 1e6).toFixed(2)}M`} color="text-amber-400" />
        <StatCard label="Best Model AUC" value={Math.max(performance.xgboost.cv_auc_mean, performance.random_forest.cv_auc_mean).toFixed(3)} sub="5-fold CV" color="text-blue-400" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">Risk Distribution</h3><DonutChart data={Object.entries(riskCounts).map(([name, value]) => ({ name, value, color: RISK_COLORS[name] }))} /></div>
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">Claims by HCPCS Code</h3><BarChart data={claimsDist.by_code} labelKey="hcpcs_code" valueKey="count" /></div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Fraud vs Legitimate Billing</h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div><p className="text-xs text-gray-500">Avg Billed/Claim</p><p className="text-lg font-bold text-red-400">${claimsDist.fraud_vs_legit.fraud.avg_billed}</p><p className="text-xs text-gray-600">Fraud</p><p className="text-lg font-bold text-green-400 mt-2">${claimsDist.fraud_vs_legit.legit.avg_billed}</p><p className="text-xs text-gray-600">Legit</p></div>
          <div><p className="text-xs text-gray-500">Avg Units/Claim</p><p className="text-lg font-bold text-red-400">{claimsDist.fraud_vs_legit.fraud.avg_units}</p><p className="text-xs text-gray-600">Fraud</p><p className="text-lg font-bold text-green-400 mt-2">{claimsDist.fraud_vs_legit.legit.avg_units}</p><p className="text-xs text-gray-600">Legit</p></div>
          <div><p className="text-xs text-gray-500">Total Billed</p><p className="text-lg font-bold text-red-400">${(claimsDist.fraud_vs_legit.fraud.total_billed / 1e6).toFixed(2)}M</p><p className="text-xs text-gray-600">Fraud</p><p className="text-lg font-bold text-green-400 mt-2">${(claimsDist.fraud_vs_legit.legit.total_billed / 1e6).toFixed(2)}M</p><p className="text-xs text-gray-600">Legit</p></div>
        </div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Top 10 Highest Risk Providers</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">Provider</th><th className="text-left py-2 px-2">State</th><th className="text-left py-2 px-2">Credential</th><th className="text-right py-2 px-2">Risk Score</th><th className="text-right py-2 px-2">Total Billed</th><th className="text-center py-2 px-2">Risk</th></tr></thead>
        <tbody>{topRisk.map(p => (<tr key={p.provider_id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]"><td className="py-2 px-2 text-blue-400 font-mono text-xs">{String(p.provider_id).slice(0, 12)}...</td><td className="py-2 px-2">{p.state}</td><td className="py-2 px-2">{p.credential}</td><td className="py-2 px-2 text-right font-mono">{p.ensemble_score.toFixed(4)}</td><td className="py-2 px-2 text-right">${p.total_billed.toLocaleString()}</td><td className="py-2 px-2 text-center"><span className={`badge badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</span></td></tr>))}</tbody></table></div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Model Performance (5-Fold CV)</h3>
        <div className="space-y-3">
          <ScoreBar label="XGBoost" value={performance.xgboost.cv_auc_mean} color="#3b82f6" />
          <ScoreBar label="Random Forest" value={performance.random_forest.cv_auc_mean} color="#22c55e" />
          <ScoreBar label="Isolation Forest" value={performance.isolation_forest.auc} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}

function LeieDashboard() {
  const [data, setData] = useState<LeieData | null>(null);
  useEffect(() => { fetch("/data/leie_dataset.json").then(r => r.ok ? r.json() : null).then(setData).catch(() => {}); }, []);
  if (!data) return <div className="text-center py-20 text-gray-500">Loading LEIE data...</div>;
  const m = data.metadata;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">LEIE Exclusion List - ABA/Behavioral Health</h2>
        <p className="text-gray-500 text-sm">Real government data: {m.total_records.toLocaleString()} total exclusions, {m.aba_related.toLocaleString()} ABA-related</p>
        <p className="text-xs text-green-500 mt-1">Reliability: 10/10 | Source: <a href={m.url} className="underline" target="_blank" rel="noopener">HHS-OIG</a></p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Exclusions" value={m.total_records.toLocaleString()} />
        <StatCard label="ABA/Behavioral" value={m.aba_related.toLocaleString()} color="text-red-400" />
        <StatCard label="States" value={m.states_represented} color="text-blue-400" />
        <StatCard label="Date Range" value={m.date_range} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Exclusions by Year</h3><LineChart data={data.aba_by_year} labelKey="excl_year" valueKey="count" color="#ef4444" /></div>
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">All Exclusions by Year</h3><LineChart data={data.all_by_year} labelKey="excl_year" valueKey="count" color="#3b82f6" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Exclusions by State</h3><BarChart data={data.aba_by_state.slice(0, 15)} labelKey="STATE" valueKey="count" color="#ef4444" horizontal /></div>
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">Exclusion Reasons</h3><BarChart data={data.aba_by_type.slice(0, 8)} labelKey="excl_type_desc" valueKey="count" color="#f59e0b" horizontal /></div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Recent Excluded Providers</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">State</th><th className="text-left py-2 px-2">Specialty</th><th className="text-left py-2 px-2">Reason</th><th className="text-left py-2 px-2">Date</th></tr></thead>
        <tbody>{data.providers.slice(0, 20).map((p, i) => (<tr key={i} className="border-b border-[#1a1a1a]"><td className="py-2 px-2 text-xs">{String(p.provider_name)}</td><td className="py-2 px-2">{String(p.state)}</td><td className="py-2 px-2 text-xs">{String(p.credential)}</td><td className="py-2 px-2 text-xs">{String(p.exclusion_type)}</td><td className="py-2 px-2 text-xs font-mono">{String(p.exclusion_date)}</td></tr>))}</tbody></table></div>
      </div>
    </div>
  );
}

interface CmsData {
  metadata: { dataset: string; source: string; url: string; status: string; total_aba_records?: number; unique_providers?: number; excluded_providers?: number; years_covered?: string[]; notes: string };
  providers: Array<Record<string, unknown>>;
  by_code?: Array<{ hcpcs_code: string; providers: number; total_services: number; avg_submitted_charge: number; avg_medicare_payment: number }>;
  by_state?: Array<{ state: string; providers: number; total_services: number }>;
  by_year?: Array<{ year: string; providers: number; total_services: number }>;
  by_provider_type?: Array<{ provider_type: string; count: number }>;
}

function CmsDashboard() {
  const [data, setData] = useState<CmsData | null>(null);
  useEffect(() => { fetch("/data/cms_dataset.json").then(r => r.ok ? r.json() : null).then(setData).catch(() => {}); }, []);
  if (!data) return <div className="text-center py-20 text-gray-500">Loading CMS data...</div>;
  const m = data.metadata;
  const hasData = m.status === "loaded" && data.providers.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-8">
        <div><h2 className="text-2xl font-bold mb-1">CMS Medicare Provider Data</h2><p className="text-gray-500 text-sm">Data not yet loaded. Run the pipeline to fetch it.</p></div>
        <div className="card"><p className="text-sm text-gray-400">Run: <code className="bg-[#1a1a1a] px-2 py-1 rounded">python3 scripts/curate_real_datasets.py</code></p></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">CMS Medicare ABA Provider Data</h2>
        <p className="text-gray-500 text-sm">Real Medicare Part B claims for ABA therapy codes 97151-97158 ({m.years_covered?.join(", ")})</p>
        <p className="text-xs text-green-500 mt-1">Reliability: 10/10 | Source: <a href={m.url} className="underline" target="_blank" rel="noopener">CMS</a></p>
        <p className="text-xs text-amber-500 mt-1">{m.notes}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="ABA Records" value={m.total_aba_records || 0} />
        <StatCard label="Unique Providers" value={m.unique_providers || 0} color="text-blue-400" />
        <StatCard label="LEIE Excluded" value={m.excluded_providers || 0} color="text-red-400" />
        <StatCard label="Years Covered" value={m.years_covered?.length || 0} />
      </div>
      {data.by_code && data.by_code.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Claims by HCPCS Code</h3>
          <BarChart data={data.by_code} labelKey="hcpcs_code" valueKey="total_services" />
          <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">Code</th><th className="text-right py-2 px-2">Providers</th><th className="text-right py-2 px-2">Services</th><th className="text-right py-2 px-2">Avg Submitted</th><th className="text-right py-2 px-2">Avg Payment</th></tr></thead>
          <tbody>{data.by_code.map(c => (<tr key={c.hcpcs_code} className="border-b border-[#1a1a1a]"><td className="py-2 px-2 font-mono text-blue-400">{c.hcpcs_code}</td><td className="py-2 px-2 text-right">{c.providers}</td><td className="py-2 px-2 text-right">{c.total_services.toLocaleString()}</td><td className="py-2 px-2 text-right">${c.avg_submitted_charge.toFixed(2)}</td><td className="py-2 px-2 text-right">${c.avg_medicare_payment.toFixed(2)}</td></tr>))}</tbody></table></div>
        </div>
      )}
      {data.by_state && data.by_state.length > 0 && (
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Providers by State</h3><BarChart data={data.by_state} labelKey="state" valueKey="providers" color="#3b82f6" horizontal /></div>
      )}
      {data.by_year && data.by_year.length > 0 && (
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Claims by Year</h3><BarChart data={data.by_year} labelKey="year" valueKey="total_services" color="#22c55e" /></div>
      )}
      {data.by_provider_type && data.by_provider_type.length > 0 && (
        <div className="card"><h3 className="text-sm font-semibold mb-4 text-gray-400">Provider Types Billing ABA Codes</h3><BarChart data={data.by_provider_type} labelKey="provider_type" valueKey="count" color="#8b5cf6" horizontal /></div>
      )}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Providers (Top by Services)</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">NPI</th><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">State</th><th className="text-left py-2 px-2">Type</th><th className="text-right py-2 px-2">Services</th><th className="text-right py-2 px-2">Beneficiaries</th><th className="text-left py-2 px-2">Codes</th><th className="text-center py-2 px-2">LEIE</th></tr></thead>
        <tbody>{data.providers.slice(0, 25).map((p, i) => (<tr key={i} className="border-b border-[#1a1a1a]"><td className="py-2 px-2 font-mono text-xs">{String(p.provider_id)}</td><td className="py-2 px-2 text-xs">{String(p.provider_name)}</td><td className="py-2 px-2">{String(p.state)}</td><td className="py-2 px-2 text-xs">{String(p.provider_type)}</td><td className="py-2 px-2 text-right">{Number(p.total_services).toLocaleString()}</td><td className="py-2 px-2 text-right">{Number(p.total_beneficiaries)}</td><td className="py-2 px-2 text-xs font-mono">{String(p.codes_used)}</td><td className="py-2 px-2 text-center">{p.is_excluded ? <span className="text-red-400 font-bold">EXCLUDED</span> : <span className="text-green-400">Clear</span>}</td></tr>))}</tbody></table></div>
      </div>
    </div>
  );
}

function TmsisDashboard() {
  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold mb-1">T-MSIS Analytic Files (Medicaid Claims)</h2><p className="text-gray-500 text-sm">Gold standard for ABA fraud research</p><p className="text-xs text-green-500 mt-1">Reliability: 10/10 | <a href="https://resdac.org/" className="underline" target="_blank" rel="noopener">CMS via ResDAC</a></p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><StatCard label="Data Years" value="2014-2023" /><StatCard label="Timeline" value="3-5 months" /><StatCard label="Initial Cost" value="$20,000" sub="+$10k/yr renewal" color="text-amber-400" /></div>
      <div className="card"><h3 className="text-sm font-semibold mb-4 text-blue-400">How to Get Access</h3><div className="space-y-4">{[{n:"1",t:"Contact ResDAC",d:"Email resdac@umn.edu or call 888-973-7322"},{n:"2",t:"Complete DUA",d:"Data Use Agreement with CMS privacy/security requirements"},{n:"3",t:"IRB + HIPAA Waiver",d:"Institution IRB approval and HIPAA waiver required"},{n:"4",t:"CMS Privacy Board",d:"CMS reviews and approves your request"},{n:"5",t:"Access via VRDC",d:"All research in Virtual Research Data Center"}].map(s => (<div key={s.n} className="flex gap-4 items-start"><div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">{s.n}</div><div><p className="text-sm font-semibold text-gray-200">{s.t}</p><p className="text-xs text-gray-400">{s.d}</p></div></div>))}</div></div>
      <div className="card"><h3 className="text-sm font-semibold mb-3 text-gray-400">Key Resources</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{[["ResDAC","https://resdac.org/"],["T-MSIS on Medicaid.gov","https://www.medicaid.gov/medicaid/data-systems/macbis/medicaid-chip-research-files/transformed-medicaid-statistical-information-system-t-msis-analytic-files-taf"],["CMS Fee Info","https://resdac.org/cms-fee-information-research-identifiable-data"],["DUA Policy Guide","https://www.cms.gov/files/document/research-identifiable-file-data-use-agreement-policies.pdf"]].map(([t, u]) => (<a key={u} href={u} className="p-2 bg-[#1a1a1a] rounded-lg text-xs text-blue-400 hover:bg-[#222]" target="_blank" rel="noopener">{t}</a>))}</div></div>
    </div>
  );
}

export default function Dashboard() {
  const { currentDataset, datasets } = useDataset();
  const info = datasets.find(d => d.id === currentDataset);
  return (
    <div>
      {info && (<div className="mb-6 p-3 rounded-lg bg-[#1a1a2a] border border-[#2a2a3a] flex items-center justify-between"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${info.has_data ? "bg-green-400" : "bg-amber-400"}`} /><span className="text-sm text-gray-300">{info.name}</span><span className="text-xs text-gray-500">|</span><span className="text-xs text-gray-500">{info.description}</span></div><span className="text-xs text-gray-500">Reliability: {info.reliability}</span></div>)}
      {currentDataset === "synthetic" && <SyntheticDashboard />}
      {currentDataset === "leie" && <LeieDashboard />}
      {currentDataset === "cms" && <CmsDashboard />}
      {currentDataset === "tmsis" && <TmsisDashboard />}
    </div>
  );
}
