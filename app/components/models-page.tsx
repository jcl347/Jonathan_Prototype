"use client";

import { useEffect, useState } from "react";
import { BarChart, ScoreBar, StatCard } from "./charts";

interface FeatureImportance { feature: string; xgb_importance: number; rf_importance: number; avg_importance: number; }
interface ClassReport { precision: number; recall: number; "f1-score": number; support: number; }
interface ModelPerf { cv_auc_mean?: number; cv_auc_std?: number; auc?: number; classification_report: { Legitimate?: ClassReport; Fraudulent?: ClassReport; "0"?: ClassReport; "1"?: ClassReport; accuracy?: number; }; }
interface AllPerformance { xgboost: ModelPerf; random_forest: ModelPerf; isolation_forest: ModelPerf; }

export default function ModelsPage() {
  const [features, setFeatures] = useState<FeatureImportance[]>([]);
  const [performance, setPerformance] = useState<AllPerformance | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/feature_importance.json").then(r => r.ok ? r.json() : []),
      fetch("/data/model_performance.json").then(r => r.ok ? r.json() : null),
    ]).then(([f, p]) => { setFeatures(f); setPerformance(p); }).catch(() => {});
  }, []);

  if (!features.length || !performance) return <div className="text-center py-20 text-gray-500">Loading model data...</div>;

  const getMetrics = (m: ModelPerf) => ({ fraud: m.classification_report["Fraudulent"] || m.classification_report["1"], legit: m.classification_report["Legitimate"] || m.classification_report["0"], accuracy: m.classification_report.accuracy });

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold">Model Performance & Feature Analysis</h2><p className="text-sm text-gray-500">Supervised (XGBoost, Random Forest) and unsupervised (Isolation Forest) comparison</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[{ name: "XGBoost", auc: performance.xgboost.cv_auc_mean!, std: performance.xgboost.cv_auc_std!, color: "text-blue-400", desc: "Gradient boosted trees, scale_pos_weight" },
          { name: "Random Forest", auc: performance.random_forest.cv_auc_mean!, std: performance.random_forest.cv_auc_std!, color: "text-green-400", desc: "Balanced class weights, 200 estimators" },
          { name: "Isolation Forest", auc: performance.isolation_forest.auc!, std: 0, color: "text-amber-400", desc: "Unsupervised anomaly detection" }
        ].map(m => (
          <div key={m.name} className="card"><p className="text-sm font-semibold text-gray-400">{m.name}</p><p className={`text-4xl font-bold mt-2 ${m.color}`}>{m.auc.toFixed(4)}</p><p className="text-xs text-gray-500 mt-1">{m.std > 0 ? `AUC +/- ${m.std.toFixed(4)} (5-fold CV)` : "AUC (unsupervised)"}</p><p className="text-xs text-gray-600 mt-2">{m.desc}</p></div>
        ))}
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Model AUC Comparison</h3>
        <div className="space-y-3">
          <ScoreBar label="XGBoost" value={performance.xgboost.cv_auc_mean!} color="#3b82f6" />
          <ScoreBar label="Random Forest" value={performance.random_forest.cv_auc_mean!} color="#22c55e" />
          <ScoreBar label="Isolation Forest" value={performance.isolation_forest.auc!} color="#f59e0b" />
        </div>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 text-gray-400">Top 15 Features by Importance</h3>
        <BarChart data={features.slice(0, 15)} labelKey="feature" valueKey="xgb_importance" color="#3b82f6" horizontal />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([["XGBoost", performance.xgboost], ["Random Forest", performance.random_forest], ["Isolation Forest", performance.isolation_forest]] as [string, ModelPerf][]).map(([name, model]) => {
          const m = getMetrics(model);
          return (
            <div key={name} className="card"><h4 className="text-sm font-semibold text-gray-400 mb-3">{name}</h4>
              <table className="w-full text-xs"><thead><tr className="text-gray-500 border-b border-[#2a2a2a]"><th className="text-left py-1">Class</th><th className="text-right py-1">Prec</th><th className="text-right py-1">Recall</th><th className="text-right py-1">F1</th></tr></thead>
              <tbody>
                {m.legit && <tr className="border-b border-[#1a1a1a]"><td className="py-1 text-green-400">Legit</td><td className="py-1 text-right font-mono">{m.legit.precision.toFixed(2)}</td><td className="py-1 text-right font-mono">{m.legit.recall.toFixed(2)}</td><td className="py-1 text-right font-mono">{m.legit["f1-score"].toFixed(2)}</td></tr>}
                {m.fraud && <tr><td className="py-1 text-red-400">Fraud</td><td className="py-1 text-right font-mono">{m.fraud.precision.toFixed(2)}</td><td className="py-1 text-right font-mono">{m.fraud.recall.toFixed(2)}</td><td className="py-1 text-right font-mono">{m.fraud["f1-score"].toFixed(2)}</td></tr>}
              </tbody></table>
              {m.accuracy !== undefined && <p className="text-xs text-gray-500 mt-2">Accuracy: {(m.accuracy * 100).toFixed(1)}%</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
