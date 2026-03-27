"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend, LineChart, Line,
} from "recharts";
import { useDataset } from "./dataset-context";

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
  xgboost: { cv_auc_mean: number; cv_auc_std: number };
  random_forest: { cv_auc_mean: number; cv_auc_std: number };
  isolation_forest: { auc: number };
}

interface ClaimsDist {
  by_code: Array<{ hcpcs_code: string; count: number; avg_billed: number; total_billed: number }>;
  fraud_vs_legit: {
    fraud: { avg_billed: number; avg_units: number; total_billed: number };
    legit: { avg_billed: number; avg_units: number; total_billed: number };
  };
}

interface LeieData {
  metadata: {
    dataset: string;
    source: string;
    url: string;
    total_records: number;
    aba_related: number;
    states_represented: number;
    date_range: string;
  };
  providers: Provider[];
  aba_by_year: Array<{ excl_year: number; count: number }>;
  aba_by_state: Array<{ STATE: string; count: number }>;
  aba_by_type: Array<{ excl_type_desc: string; count: number }>;
  all_by_year: Array<{ excl_year: number; count: number }>;
  specialty_dist: Array<{ specialty: string; count: number }>;
}

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#eab308",
  Low: "#22c55e",
};

function SyntheticDashboard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [claimsDist, setClaimsDist] = useState<ClaimsDist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/providers.json").then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
      fetch("/data/model_performance.json").then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
      fetch("/data/claims_distribution.json").then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    ]).then(([p, m, c]) => { setProviders(p); setPerformance(m); setClaimsDist(c); })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="text-center py-20"><p className="text-red-400">Failed to load: {error}</p></div>;
  if (!providers.length || !performance || !claimsDist) return <div className="text-center py-20 text-gray-500">Loading...</div>;

  const riskCounts = providers.reduce((acc, p) => { acc[p.risk_level] = (acc[p.risk_level] || 0) + 1; return acc; }, {} as Record<string, number>);
  const riskPieData = Object.entries(riskCounts).map(([name, value]) => ({ name, value, color: RISK_COLORS[name] || "#666" }));
  const topRisk = providers.slice(0, 10);
  const totalFlagged = providers.filter((p) => p.risk_level === "Critical" || p.risk_level === "High").length;
  const totalBilledFraud = providers.filter((p) => p.risk_level === "Critical" || p.risk_level === "High").reduce((sum, p) => sum + p.total_billed, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Synthetic ABA Fraud Dataset</h2>
        <p className="text-gray-500 text-sm">
          ML-generated dataset: {providers.length} providers, ~9.5% fraud rate. Modeled on OIG audit findings.
        </p>
        <p className="text-xs text-amber-500 mt-1">Reliability: 6/10 (training tool) | Source: Generated</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card"><p className="text-xs text-gray-500 uppercase">Total Providers</p><p className="text-3xl font-bold mt-1">{providers.length}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Flagged (High/Critical)</p><p className="text-3xl font-bold mt-1 text-red-400">{totalFlagged}</p><p className="text-xs text-gray-500">{((totalFlagged / providers.length) * 100).toFixed(1)}%</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Suspicious Billing</p><p className="text-3xl font-bold mt-1 text-amber-400">${(totalBilledFraud / 1e6).toFixed(2)}M</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Best Model AUC</p><p className="text-3xl font-bold mt-1 text-blue-400">{Math.max(performance.xgboost.cv_auc_mean, performance.random_forest.cv_auc_mean).toFixed(3)}</p><p className="text-xs text-gray-500">5-fold CV</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Provider Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={riskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{riskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Claims by HCPCS Code</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={claimsDist.by_code}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="hcpcs_code" tick={{ fill: "#999", fontSize: 11 }} /><YAxis tick={{ fill: "#999", fontSize: 11 }} /><Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">Provider</th><th className="text-left py-2 px-2">State</th><th className="text-left py-2 px-2">Credential</th><th className="text-right py-2 px-2">Risk Score</th><th className="text-right py-2 px-2">Total Billed</th><th className="text-center py-2 px-2">Risk</th></tr></thead>
            <tbody>
              {topRisk.map((p) => (
                <tr key={p.provider_id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2 px-2"><a href={`/providers?id=${p.provider_id}`} className="text-blue-400 hover:underline">{p.provider_id.slice(0, 12)}...</a></td>
                  <td className="py-2 px-2">{p.state}</td><td className="py-2 px-2">{p.credential}</td>
                  <td className="py-2 px-2 text-right font-mono">{p.ensemble_score.toFixed(4)}</td>
                  <td className="py-2 px-2 text-right">${p.total_billed.toLocaleString()}</td>
                  <td className="py-2 px-2 text-center"><span className={`badge badge-${p.risk_level.toLowerCase()}`}>{p.risk_level}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Model Performance (5-Fold CV)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg"><p className="text-xs text-gray-500">XGBoost</p><p className="text-2xl font-bold text-blue-400">{performance.xgboost.cv_auc_mean.toFixed(3)}</p></div>
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg"><p className="text-xs text-gray-500">Random Forest</p><p className="text-2xl font-bold text-green-400">{performance.random_forest.cv_auc_mean.toFixed(3)}</p></div>
          <div className="text-center p-4 bg-[#1a1a1a] rounded-lg"><p className="text-xs text-gray-500">Isolation Forest</p><p className="text-2xl font-bold text-amber-400">{performance.isolation_forest.auc.toFixed(3)}</p></div>
        </div>
      </div>
    </div>
  );
}

function LeieDashboard() {
  const [data, setData] = useState<LeieData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/leie_dataset.json")
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="text-center py-20"><p className="text-red-400">Failed to load LEIE data: {error}</p></div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Loading LEIE data...</div>;

  const meta = data.metadata;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">LEIE Exclusion List - ABA/Behavioral Health Focus</h2>
        <p className="text-gray-500 text-sm">
          Real government data: {meta.total_records.toLocaleString()} total exclusions, {meta.aba_related.toLocaleString()} ABA/behavioral health related
        </p>
        <p className="text-xs text-green-500 mt-1">
          Reliability: 10/10 | Source: <a href={meta.url} className="underline" target="_blank" rel="noopener">HHS Office of Inspector General</a>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card"><p className="text-xs text-gray-500 uppercase">Total Exclusions</p><p className="text-3xl font-bold mt-1">{meta.total_records.toLocaleString()}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">ABA/Behavioral Health</p><p className="text-3xl font-bold mt-1 text-red-400">{meta.aba_related.toLocaleString()}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">States Represented</p><p className="text-3xl font-bold mt-1 text-blue-400">{meta.states_represented}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Date Range</p><p className="text-xl font-bold mt-1">{meta.date_range}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">ABA/Behavioral Health Exclusions by Year</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.aba_by_year}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="excl_year" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis tick={{ fill: "#999", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">All Healthcare Exclusions by Year</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.all_by_year}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="excl_year" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis tick={{ fill: "#999", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">ABA Exclusions by State (Top 25)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.aba_by_state} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis type="category" dataKey="STATE" tick={{ fill: "#999", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Exclusion Reasons (ABA/Behavioral)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.aba_by_type.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
              <YAxis type="category" dataKey="excl_type_desc" tick={{ fill: "#999", fontSize: 9 }} width={200} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Top Excluded Specialties (All Healthcare)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.specialty_dist} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
            <YAxis type="category" dataKey="specialty" tick={{ fill: "#999", fontSize: 9 }} width={180} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Recent ABA/Behavioral Health Excluded Providers</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">NPI</th><th className="text-left py-2 px-2">State</th><th className="text-left py-2 px-2">Specialty</th><th className="text-left py-2 px-2">Exclusion Reason</th><th className="text-left py-2 px-2">Date</th></tr></thead>
            <tbody>
              {data.providers.slice(0, 25).map((p, i) => (
                <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2 px-2 text-xs">{p.provider_name}</td>
                  <td className="py-2 px-2 text-xs font-mono">{p.provider_id}</td>
                  <td className="py-2 px-2">{p.state}</td>
                  <td className="py-2 px-2 text-xs">{p.credential}</td>
                  <td className="py-2 px-2 text-xs">{(p as unknown as Record<string, unknown>).exclusion_type as string}</td>
                  <td className="py-2 px-2 text-xs font-mono">{(p as unknown as Record<string, unknown>).exclusion_date as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-3">Showing 25 of {data.providers.length} ABA/behavioral health exclusions</p>
      </div>

      <div className="card text-xs text-gray-500">
        <p className="font-semibold text-gray-400 mb-1">About This Dataset</p>
        <p>The LEIE is the official list of individuals and entities excluded from federal healthcare programs, maintained by the HHS Office of Inspector General. Exclusion reasons include fraud convictions, patient abuse, license revocation, and other violations. This is ground-truth data - all listed providers have been formally excluded after investigation.</p>
      </div>
    </div>
  );
}

function CmsDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/data/cms_dataset.json").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const meta = data?.metadata as Record<string, unknown> | undefined;
  const instructions = (meta?.instructions as string[]) || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">CMS Medicare Provider Data</h2>
        <p className="text-gray-500 text-sm">Real Medicare claims data by NPI and HCPCS code - filter for ABA therapy codes 97151-97158</p>
        <p className="text-xs text-green-500 mt-1">
          Reliability: 10/10 | Source: <a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service" className="underline" target="_blank" rel="noopener">Centers for Medicare & Medicaid Services</a>
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-amber-400">Manual Download Required</h3>
        <p className="text-sm text-gray-400 mb-4">
          The CMS dataset is too large to download automatically (~9GB full file). Follow these steps to integrate it:
        </p>
        <ol className="space-y-2 text-sm text-gray-300">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-2"><span className="text-blue-400 font-mono">{i + 1}.</span>{step}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">ABA HCPCS Codes to Filter</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const codes = meta?.aba_hcpcs_codes as Record<string, string> | undefined;
            if (!codes) return null;
            return Object.entries(codes).map(([code, desc]) => (
              <div key={code} className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-blue-400 font-mono font-bold">{code}</p>
                <p className="text-xs text-gray-500 mt-1">{String(desc)}</p>
              </div>
            ));
          })()}
        </div>
      </div>

      <div className="card text-xs text-gray-500">
        <p className="font-semibold text-gray-400 mb-1">Notes</p>
        <p>{meta?.notes as string}</p>
      </div>
    </div>
  );
}

interface TmsisStep {
  title: string;
  detail: string;
  url?: string;
}

interface TmsisFileType {
  file: string;
  description: string;
}

interface TmsisRef {
  title: string;
  url: string;
}

function TmsisDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/data/tmsis_dataset.json").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const meta = data?.metadata as Record<string, unknown> | undefined;
  const steps = meta?.access_process as Record<string, TmsisStep> | undefined;
  const costs = meta?.costs as Record<string, string> | undefined;
  const fileTypes = meta?.taf_file_types as TmsisFileType[] | undefined;
  const refs = meta?.key_references as TmsisRef[] | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">T-MSIS Analytic Files (Medicaid Claims)</h2>
        <p className="text-gray-500 text-sm">The gold standard for ABA fraud research - all Medicaid/CHIP claims across all states</p>
        <p className="text-xs text-green-500 mt-1">
          Reliability: 10/10 | Source: <a href="https://resdac.org/" className="underline" target="_blank" rel="noopener">CMS via ResDAC</a>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-gray-500 uppercase">Data Years Available</p><p className="text-xl font-bold mt-1">{String(meta?.data_years_available || "2014-2023")}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Processing Time</p><p className="text-xl font-bold mt-1">{String(meta?.timeline || "3-5 months")}</p></div>
        <div className="card"><p className="text-xs text-gray-500 uppercase">Initial Cost</p><p className="text-xl font-bold mt-1 text-amber-400">{costs?.initial_project_fee || "$20,000"}</p><p className="text-xs text-gray-500">+ {costs?.annual_renewal_fee || "$10,000"}/yr renewal</p></div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-blue-400">How to Get Access (Step-by-Step)</h3>
        <div className="space-y-4">
          {steps && Object.entries(steps).map(([key, step]) => (
            <div key={key} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                {key.split("_")[1]}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-200">{step.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.detail}</p>
                {step.url && <a href={step.url} className="text-xs text-blue-400 underline mt-1 inline-block" target="_blank" rel="noopener">{step.url}</a>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">TAF File Types</h3>
          <div className="space-y-2">
            {fileTypes?.map((ft) => (
              <div key={ft.file} className={`p-2 rounded-lg text-xs ${(meta?.aba_relevant_files as string[] || []).some((f: string) => f.includes(ft.file)) ? "bg-blue-500/10 border border-blue-500/20" : "bg-[#1a1a1a]"}`}>
                <p className="font-semibold text-gray-300">{ft.file}</p>
                <p className="text-gray-500">{ft.description}</p>
                {(meta?.aba_relevant_files as string[] || []).some((f: string) => f.includes(ft.file)) && (
                  <p className="text-blue-400 mt-0.5">Relevant for ABA fraud research</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4 text-gray-400">Costs</h3>
          <div className="space-y-3">
            {costs && Object.entries(costs).filter(([k]) => k !== "note" && k !== "cost_estimator").map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{key.replace(/_/g, " ")}</span>
                <span className="text-sm font-mono text-gray-200">{String(value)}</span>
              </div>
            ))}
          </div>
          {costs?.cost_estimator && (
            <a href={costs.cost_estimator} className="text-xs text-blue-400 underline mt-3 inline-block" target="_blank" rel="noopener">CCW Cost Estimator Tool</a>
          )}
          {costs?.note && <p className="text-xs text-gray-500 mt-2">{costs.note}</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Key References & Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {refs?.map((ref) => (
            <a key={ref.url} href={ref.url} className="p-2 bg-[#1a1a1a] rounded-lg text-xs text-blue-400 hover:bg-[#222] transition" target="_blank" rel="noopener">
              {ref.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentDataset, datasets } = useDataset();

  const currentInfo = datasets.find((d) => d.id === currentDataset);

  return (
    <div>
      {/* Dataset Info Banner */}
      {currentInfo && (
        <div className="mb-6 p-3 rounded-lg bg-[#1a1a2a] border border-[#2a2a3a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${currentInfo.has_data ? "bg-green-400" : "bg-amber-400"}`} />
            <span className="text-sm text-gray-300">{currentInfo.name}</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-gray-500">{currentInfo.description}</span>
          </div>
          <span className="text-xs text-gray-500">Reliability: {currentInfo.reliability}</span>
        </div>
      )}

      {currentDataset === "synthetic" && <SyntheticDashboard />}
      {currentDataset === "leie" && <LeieDashboard />}
      {currentDataset === "cms" && <CmsDashboard />}
      {currentDataset === "tmsis" && <TmsisDashboard />}
    </div>
  );
}
