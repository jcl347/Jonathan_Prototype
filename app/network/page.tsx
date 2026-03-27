"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";
import { ClientOnly } from "../client-only";

interface Community {
  community_id: number;
  size: number;
  fraud_count: number;
  fraud_rate: number;
  density: number;
  avg_clustering: number;
  is_suspicious: boolean;
  providers: string[];
}

interface NetworkNode {
  id: string;
  name: string;
  state: string;
  is_fraud: boolean;
  risk_score: number;
  community_id: number;
  degree: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  relationship: string;
}

interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

function NetworkPageInner() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/communities.json").then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
      fetch("/data/network.json").then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
    ]).then(([c, n]) => {
      setCommunities(c);
      setNetwork(n);
    }).catch((err) => console.error("Failed to load network data:", err));
  }, []);

  if (!communities.length || !network) {
    return <div className="text-center py-20 text-gray-500">Loading network data...</div>;
  }

  const suspicious = communities.filter((c) => c.is_suspicious);
  const communityChartData = communities
    .filter((c) => c.size >= 2)
    .map((c) => ({
      id: `C${c.community_id}`,
      size: c.size,
      fraud_rate: Math.round(c.fraud_rate * 100),
      density: c.density,
      is_suspicious: c.is_suspicious,
    }))
    .sort((a, b) => b.fraud_rate - a.fraud_rate)
    .slice(0, 20);

  const scatterData = communities
    .filter((c) => c.size >= 2)
    .map((c) => ({
      x: c.density,
      y: c.fraud_rate,
      z: c.size,
      id: c.community_id,
      suspicious: c.is_suspicious,
    }));

  const communityMembers = selectedCommunity
    ? network.nodes.filter((n) => selectedCommunity.providers.includes(n.id))
    : [];

  const communityEdges = selectedCommunity
    ? network.edges.filter(
        (e) =>
          selectedCommunity.providers.includes(e.source) &&
          selectedCommunity.providers.includes(e.target)
      )
    : [];

  const relationshipDist = communityEdges.reduce(
    (acc, e) => {
      acc[e.relationship] = (acc[e.relationship] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Network Analysis</h2>
        <p className="text-sm text-gray-500">
          Louvain community detection identifying potential fraud rings among ABA therapy providers.
          Based on referral networks, shared patients, and organizational relationships.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Total Communities</p>
          <p className="text-3xl font-bold">{communities.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Suspicious Communities</p>
          <p className="text-3xl font-bold text-red-400">{suspicious.length}</p>
          <p className="text-xs text-gray-500">&gt;30% fraud rate & 3+ members</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Network Nodes</p>
          <p className="text-3xl font-bold">{network.nodes.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Network Edges</p>
          <p className="text-3xl font-bold">{network.edges.length}</p>
        </div>
      </div>

      {/* Community Fraud Rate Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Community Fraud Rates (Top 20)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={communityChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="id" tick={{ fill: "#999", fontSize: 11 }} />
            <YAxis tick={{ fill: "#999", fontSize: 11 }} label={{ value: "Fraud Rate %", angle: -90, position: "insideLeft", fill: "#666" }} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
            <Bar dataKey="fraud_rate" radius={[4, 4, 0, 0]}>
              {communityChartData.map((entry, i) => (
                <Cell key={i} fill={entry.is_suspicious ? "#ef4444" : "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Density vs Fraud Rate Scatter */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">
          Community Density vs Fraud Rate (bubble size = community size)
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" dataKey="x" name="Density" tick={{ fill: "#999", fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Fraud Rate" tick={{ fill: "#999", fontSize: 11 }} />
            <ZAxis type="number" dataKey="z" range={[40, 400]} name="Size" />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
              formatter={(v) => {
                const val = Number(v);
                return isNaN(val) ? String(v) : val.toFixed(4);
              }}
            />
            <Scatter data={scatterData.filter((d) => !d.suspicious)} fill="#3b82f6" fillOpacity={0.6} name="Normal" />
            <Scatter data={scatterData.filter((d) => d.suspicious)} fill="#ef4444" fillOpacity={0.8} name="Suspicious" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Community Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h3 className="text-sm font-semibold mb-3 text-gray-400">Communities</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {communities
              .filter((c) => c.size >= 2)
              .sort((a, b) => b.fraud_rate - a.fraud_rate)
              .map((c) => (
                <div
                  key={c.community_id}
                  onClick={() => setSelectedCommunity(c)}
                  className={`card cursor-pointer transition hover:border-blue-500/50 ${
                    selectedCommunity?.community_id === c.community_id ? "border-blue-500" : ""
                  } ${c.is_suspicious ? "border-red-500/30" : ""}`}
                  style={{ padding: "0.6rem 0.8rem" }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">Community #{c.community_id}</p>
                      <p className="text-xs text-gray-500">
                        {c.size} providers | Density: {c.density.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${c.fraud_rate > 0.3 ? "text-red-400" : "text-green-400"}`}>
                        {(c.fraud_rate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">fraud</p>
                    </div>
                  </div>
                  {c.is_suspicious && (
                    <p className="text-xs text-red-400 mt-1">Suspicious - potential fraud ring</p>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedCommunity ? (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-bold">
                  Community #{selectedCommunity.community_id}
                  {selectedCommunity.is_suspicious && (
                    <span className="badge badge-critical ml-3">Suspicious Ring</span>
                  )}
                </h3>
                <div className="grid grid-cols-4 gap-4 mt-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="text-xl font-bold">{selectedCommunity.size}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fraud Rate</p>
                    <p className={`text-xl font-bold ${selectedCommunity.fraud_rate > 0.3 ? "text-red-400" : "text-green-400"}`}>
                      {(selectedCommunity.fraud_rate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Density</p>
                    <p className="text-xl font-bold">{selectedCommunity.density.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Clustering</p>
                    <p className="text-xl font-bold">{selectedCommunity.avg_clustering.toFixed(4)}</p>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">
                  Members ({communityMembers.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase border-b border-[#2a2a2a]">
                        <th className="text-left py-2">Provider</th>
                        <th className="text-left py-2">State</th>
                        <th className="text-right py-2">Risk Score</th>
                        <th className="text-right py-2">Degree</th>
                        <th className="text-center py-2">Fraud</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communityMembers
                        .sort((a, b) => b.risk_score - a.risk_score)
                        .map((m) => (
                          <tr key={m.id} className="border-b border-[#1a1a1a]">
                            <td className="py-1.5 font-mono text-xs">{m.id.slice(0, 14)}...</td>
                            <td className="py-1.5">{m.state}</td>
                            <td className="py-1.5 text-right font-mono">{m.risk_score.toFixed(4)}</td>
                            <td className="py-1.5 text-right">{m.degree}</td>
                            <td className="py-1.5 text-center">
                              {m.is_fraud ? (
                                <span className="text-red-400">Yes</span>
                              ) : (
                                <span className="text-green-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Relationships */}
              {Object.keys(relationshipDist).length > 0 && (
                <div className="card">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Internal Relationships</h4>
                  <div className="flex gap-4">
                    {Object.entries(relationshipDist).map(([rel, count]) => (
                      <div key={rel} className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">{rel.replace("_", " ")}</p>
                        <p className="text-lg font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-20">
              <p className="text-gray-500">Select a community to explore</p>
            </div>
          )}
        </div>
      </div>

      {/* Methodology */}
      <div className="card text-xs text-gray-500">
        <h4 className="font-semibold text-gray-400 mb-2">Network Analysis Methodology</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>Community detection using Louvain algorithm (Blondel et al., 2008) via NetworkX</li>
          <li>Edge types: referrals, shared patients, shared locations, same organization</li>
          <li>Suspicious communities flagged when fraud rate &gt;30% with 3+ members</li>
          <li>PageRank centrality identifies key nodes in potential fraud networks</li>
          <li>Reference: Zhou et al. - Leveraging community detection for collective medical fraud (PMC)</li>
          <li>Reference: Graph-Based Fraud Detection Network (GraphSAGE + Louvain + BFS)</li>
        </ul>
      </div>
    </div>
  );
}

export default function NetworkPage() {
  return <ClientOnly><NetworkPageInner /></ClientOnly>;
}
