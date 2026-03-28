"use client";

import { useEffect, useState } from "react";
import { BarChart, StatCard } from "./charts";

interface Community { community_id: number; size: number; fraud_count: number; fraud_rate: number; density: number; avg_clustering: number; is_suspicious: boolean; providers: string[]; }
interface NetworkNode { id: string; name: string; state: string; is_fraud: boolean; risk_score: number; community_id: number; degree: number; }
interface NetworkEdge { source: string; target: string; weight: number; relationship: string; }
interface NetworkData { nodes: NetworkNode[]; edges: NetworkEdge[]; }

export default function NetworkPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/communities.json").then(r => r.ok ? r.json() : []),
      fetch("/data/network.json").then(r => r.ok ? r.json() : { nodes: [], edges: [] }),
    ]).then(([c, n]) => { setCommunities(c); setNetwork(n); }).catch(() => {});
  }, []);

  if (!communities.length || !network) return <div className="text-center py-20 text-gray-500">Loading network data...</div>;

  const suspicious = communities.filter(c => c.is_suspicious);
  const chartData = communities.filter(c => c.size >= 2).sort((a, b) => b.fraud_rate - a.fraud_rate).slice(0, 20).map(c => ({ id: `C${c.community_id}`, fraud_rate: Math.round(c.fraud_rate * 100), is_suspicious: c.is_suspicious }));

  const members = selectedCommunity ? network.nodes.filter(n => selectedCommunity.providers.includes(n.id)) : [];
  const edges = selectedCommunity ? network.edges.filter(e => selectedCommunity.providers.includes(e.source) && selectedCommunity.providers.includes(e.target)) : [];
  const relDist = edges.reduce((a, e) => { a[e.relationship] = (a[e.relationship] || 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold">Network Analysis</h2><p className="text-sm text-gray-500">Louvain community detection for ABA therapy fraud rings</p></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Communities" value={communities.length} />
        <StatCard label="Suspicious" value={suspicious.length} sub=">30% fraud rate & 3+ members" color="text-red-400" />
        <StatCard label="Network Nodes" value={network.nodes.length} />
        <StatCard label="Network Edges" value={network.edges.length} />
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Community Fraud Rates (Top 20)</h3>
        <BarChart data={chartData} labelKey="id" valueKey="fraud_rate" color={(d) => (d as {is_suspicious: boolean}).is_suspicious ? "#ef4444" : "#3b82f6"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h3 className="text-sm font-semibold mb-3 text-gray-400">Communities</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {communities.filter(c => c.size >= 2).sort((a, b) => b.fraud_rate - a.fraud_rate).map(c => (
              <div key={c.community_id} onClick={() => setSelectedCommunity(c)} className={`card cursor-pointer transition hover:border-blue-500/50 ${selectedCommunity?.community_id === c.community_id ? "border-blue-500" : ""} ${c.is_suspicious ? "border-red-500/30" : ""}`} style={{ padding: "0.6rem 0.8rem" }}>
                <div className="flex justify-between items-center">
                  <div><p className="text-sm font-semibold">Community #{c.community_id}</p><p className="text-xs text-gray-500">{c.size} providers | Density: {c.density.toFixed(3)}</p></div>
                  <div className="text-right"><p className={`text-sm font-bold ${c.fraud_rate > 0.3 ? "text-red-400" : "text-green-400"}`}>{(c.fraud_rate * 100).toFixed(0)}%</p><p className="text-xs text-gray-500">fraud</p></div>
                </div>
                {c.is_suspicious && <p className="text-xs text-red-400 mt-1">Suspicious - potential fraud ring</p>}
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          {selectedCommunity ? (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-bold">Community #{selectedCommunity.community_id} {selectedCommunity.is_suspicious && <span className="badge badge-critical ml-3">Suspicious Ring</span>}</h3>
                <div className="grid grid-cols-4 gap-4 mt-4 text-center">
                  <div><p className="text-xs text-gray-500">Members</p><p className="text-xl font-bold">{selectedCommunity.size}</p></div>
                  <div><p className="text-xs text-gray-500">Fraud Rate</p><p className={`text-xl font-bold ${selectedCommunity.fraud_rate > 0.3 ? "text-red-400" : "text-green-400"}`}>{(selectedCommunity.fraud_rate * 100).toFixed(0)}%</p></div>
                  <div><p className="text-xs text-gray-500">Density</p><p className="text-xl font-bold">{selectedCommunity.density.toFixed(4)}</p></div>
                  <div><p className="text-xs text-gray-500">Avg Clustering</p><p className="text-xl font-bold">{selectedCommunity.avg_clustering.toFixed(4)}</p></div>
                </div>
              </div>
              <div className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">Members ({members.length})</h4>
                <table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]"><th className="text-left py-2">Provider</th><th className="text-left py-2">State</th><th className="text-right py-2">Risk Score</th><th className="text-right py-2">Degree</th><th className="text-center py-2">Fraud</th></tr></thead>
                <tbody>{members.sort((a, b) => b.risk_score - a.risk_score).map(m => (<tr key={m.id} className="border-b border-[#1a1a1a]"><td className="py-1.5 font-mono text-xs">{m.id.slice(0, 14)}...</td><td className="py-1.5">{m.state}</td><td className="py-1.5 text-right font-mono">{m.risk_score.toFixed(4)}</td><td className="py-1.5 text-right">{m.degree}</td><td className="py-1.5 text-center">{m.is_fraud ? <span className="text-red-400">Yes</span> : <span className="text-green-400">No</span>}</td></tr>))}</tbody></table>
              </div>
              {Object.keys(relDist).length > 0 && <div className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">Relationships</h4><div className="flex gap-4">{Object.entries(relDist).map(([rel, count]) => (<div key={rel} className="bg-[#1a1a1a] rounded-lg px-3 py-2"><p className="text-xs text-gray-500">{rel.replace("_", " ")}</p><p className="text-lg font-bold">{count}</p></div>))}</div></div>}
            </div>
          ) : <div className="card text-center py-20"><p className="text-gray-500">Select a community to explore</p></div>}
        </div>
      </div>
    </div>
  );
}
