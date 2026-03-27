"use client";

import { useDataset } from "./dataset-context";

export function Nav() {
  const { currentDataset, setCurrentDataset, datasets } = useDataset();

  return (
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
        <div className="flex items-center gap-6">
          <div className="flex gap-6 text-sm">
            <a href="/" className="text-gray-400 hover:text-white transition">Dashboard</a>
            <a href="/providers" className="text-gray-400 hover:text-white transition">Providers</a>
            <a href="/network" className="text-gray-400 hover:text-white transition">Network</a>
            <a href="/models" className="text-gray-400 hover:text-white transition">Models</a>
          </div>
          {datasets.length > 1 && (
            <select
              value={currentDataset}
              onChange={(e) => setCurrentDataset(e.target.value)}
              className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-gray-300"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </nav>
  );
}
