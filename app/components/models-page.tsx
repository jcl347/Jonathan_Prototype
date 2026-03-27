"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

interface FeatureImportance {
  feature: string;
  xgb_importance: number;
  rf_importance: number;
  avg_importance: number;
}

interface ClassReport {
  precision: number;
  recall: number;
  "f1-score": number;
  support: number;
}

interface ModelPerf {
  cv_auc_mean?: number;
  cv_auc_std?: number;
  auc?: number;
  classification_report: {
    Legitimate?: ClassReport;
    Fraudulent?: ClassReport;
    "0"?: ClassReport;
    "1"?: ClassReport;
    accuracy?: number;
  };
}

interface AllPerformance {
  xgboost: ModelPerf;
  random_forest: ModelPerf;
  isolation_forest: ModelPerf;
}

function ModelsPageInner() {
  const [features, setFeatures] = useState<FeatureImportance[]>([]);
  const [performance, setPerformance] = useState<AllPerformance | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/feature_importance.json").then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
      fetch("/data/model_performance.json").then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
    ]).then(([f, p]) => {
      setFeatures(f);
      setPerformance(p);
    }).catch((err) => console.error("Failed to load model data:", err));
  }, []);

  if (!features.length || !performance) {
    return <div className="text-center py-20 text-gray-500">Loading model data...</div>;
  }

  const topFeatures = features.slice(0, 15);

  const getMetrics = (model: ModelPerf) => {
    const report = model.classification_report;
    const fraud = report["Fraudulent"] || report["1"];
    const legit = report["Legitimate"] || report["0"];
    return { fraud, legit, accuracy: report.accuracy };
  };

  const modelComparison = [
    {
      metric: "AUC (CV)",
      XGBoost: performance.xgboost.cv_auc_mean || 0,
      "Random Forest": performance.random_forest.cv_auc_mean || 0,
      "Isolation Forest": performance.isolation_forest.auc || 0,
    },
    {
      metric: "Precision (Fraud)",
      XGBoost: getMetrics(performance.xgboost).fraud?.precision || 0,
      "Random Forest": getMetrics(performance.random_forest).fraud?.precision || 0,
      "Isolation Forest": getMetrics(performance.isolation_forest).fraud?.precision || 0,
    },
    {
      metric: "Recall (Fraud)",
      XGBoost: getMetrics(performance.xgboost).fraud?.recall || 0,
      "Random Forest": getMetrics(performance.random_forest).fraud?.recall || 0,
      "Isolation Forest": getMetrics(performance.isolation_forest).fraud?.recall || 0,
    },
    {
      metric: "F1 (Fraud)",
      XGBoost: getMetrics(performance.xgboost).fraud?.["f1-score"] || 0,
      "Random Forest": getMetrics(performance.random_forest).fraud?.["f1-score"] || 0,
      "Isolation Forest": getMetrics(performance.isolation_forest).fraud?.["f1-score"] || 0,
    },
  ];

  const radarData = modelComparison.map((m) => ({
    metric: m.metric,
    XGBoost: m.XGBoost * 100,
    "Random Forest": m["Random Forest"] * 100,
    "Isolation Forest": m["Isolation Forest"] * 100,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Model Performance & Feature Analysis</h2>
        <p className="text-sm text-gray-500">
          Comparison of supervised (XGBoost, Random Forest) and unsupervised (Isolation Forest)
          approaches with extensive feature engineering
        </p>
      </div>

      {/* Model AUC Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            name: "XGBoost",
            auc: performance.xgboost.cv_auc_mean!,
            std: performance.xgboost.cv_auc_std!,
            color: "text-blue-400",
            desc: "Gradient boosted trees with scale_pos_weight for class imbalance",
          },
          {
            name: "Random Forest",
            auc: performance.random_forest.cv_auc_mean!,
            std: performance.random_forest.cv_auc_std!,
            color: "text-green-400",
            desc: "Balanced class weights, 200 estimators, max depth 10",
          },
          {
            name: "Isolation Forest",
            auc: performance.isolation_forest.auc!,
            std: 0,
            color: "text-amber-400",
            desc: "Unsupervised anomaly detection, contamination=0.12",
          },
        ].map((m) => (
          <div key={m.name} className="card">
            <p className="text-sm font-semibold text-gray-400">{m.name}</p>
            <p className={`text-4xl font-bold mt-2 ${m.color}`}>{m.auc.toFixed(4)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {m.std > 0 ? `AUC +/- ${m.std.toFixed(4)} (5-fold CV)` : "AUC (unsupervised)"}
            </p>
            <p className="text-xs text-gray-600 mt-2">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Model Comparison Radar */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Model Comparison</h3>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#333" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#999", fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: "#666", fontSize: 10 }} domain={[0, 100]} />
            <Radar name="XGBoost" dataKey="XGBoost" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            <Radar name="Random Forest" dataKey="Random Forest" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
            <Radar name="Isolation Forest" dataKey="Isolation Forest" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Feature Importance */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Top 15 Features by Importance</h3>
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={topFeatures} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" tick={{ fill: "#999", fontSize: 11 }} />
            <YAxis type="category" dataKey="feature" tick={{ fill: "#999", fontSize: 10 }} width={180} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
            <Legend />
            <Bar dataKey="xgb_importance" name="XGBoost" fill="#3b82f6" />
            <Bar dataKey="rf_importance" name="Random Forest" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Classification Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(
          [
            ["XGBoost", performance.xgboost],
            ["Random Forest", performance.random_forest],
            ["Isolation Forest", performance.isolation_forest],
          ] as [string, ModelPerf][]
        ).map(([name, model]) => {
          const metrics = getMetrics(model);
          return (
            <div key={name} className="card">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">{name} - Classification Report</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-1">Class</th>
                    <th className="text-right py-1">Precision</th>
                    <th className="text-right py-1">Recall</th>
                    <th className="text-right py-1">F1</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.legit && (
                    <tr className="border-b border-[#1a1a1a]">
                      <td className="py-1 text-green-400">Legitimate</td>
                      <td className="py-1 text-right font-mono">{metrics.legit.precision.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{metrics.legit.recall.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{metrics.legit["f1-score"].toFixed(2)}</td>
                    </tr>
                  )}
                  {metrics.fraud && (
                    <tr>
                      <td className="py-1 text-red-400">Fraudulent</td>
                      <td className="py-1 text-right font-mono">{metrics.fraud.precision.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{metrics.fraud.recall.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{metrics.fraud["f1-score"].toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {metrics.accuracy !== undefined && (
                <p className="text-xs text-gray-500 mt-2">Accuracy: {(metrics.accuracy * 100).toFixed(1)}%</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature Engineering Methodology */}
      <div className="card text-xs text-gray-500">
        <h4 className="font-semibold text-gray-400 mb-2">Feature Engineering Approach</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-gray-400 mb-1">Billing Pattern Features</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>HCPCS code distribution ratios (97151-97158)</li>
              <li>High-reimbursement code ratio (upcoding indicator)</li>
              <li>Billed-to-allowed amount ratio</li>
              <li>Claims per patient (phantom billing indicator)</li>
              <li>Billing amount statistics (mean, std, max)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-400 mb-1">Temporal Features</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Weekend billing ratio</li>
              <li>School-hours billing ratio (for school-age patients)</li>
              <li>Monthly billing entropy (consistency measure)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-400 mb-1">Statistical Features</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Benford&apos;s Law deviation (leading digit analysis)</li>
              <li>Unit count statistics (mean, std, max)</li>
              <li>Geographic mismatch ratio</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-400 mb-1">Network Features (separate analysis)</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>PageRank centrality</li>
              <li>Louvain community detection</li>
              <li>Clustering coefficient</li>
              <li>Weighted degree centrality</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  return <ModelsPageInner />;
}
