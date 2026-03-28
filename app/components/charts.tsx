"use client";

// Pure CSS/Tailwind chart components - zero external dependencies, SSR-safe

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BarChart({ data, labelKey, valueKey, color = "#3b82f6", maxValue, horizontal = false }: {
  data: any[];
  labelKey: string;
  valueKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  color?: string | ((item: any) => string);
  maxValue?: number;
  horizontal?: boolean;
}) {
  const max = maxValue || Math.max(...data.map(d => Number(d[valueKey]) || 0));
  if (horizontal) {
    return (
      <div className="space-y-2">
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const pct = max > 0 ? (val / max) * 100 : 0;
          const c = typeof color === "function" ? color(d) : color;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-40 truncate text-right">{String(d[labelKey])}</span>
              <div className="flex-1 bg-[#1a1a1a] rounded-full h-5 relative">
                <div className="h-5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }} />
              </div>
              <span className="text-xs text-gray-400 w-16 text-right font-mono">{typeof val === "number" && val < 1 ? val.toFixed(3) : val.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1 h-48">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        const c = typeof color === "function" ? color(d) : color;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-gray-500 font-mono">{typeof val === "number" && val > 999 ? `${(val/1000).toFixed(0)}k` : val}</span>
            <div className="w-full bg-[#1a1a1a] rounded-t flex-1 relative flex items-end">
              <div className="w-full rounded-t transition-all" style={{ height: `${pct}%`, backgroundColor: c }} />
            </div>
            <span className="text-[9px] text-gray-500 truncate w-full text-center">{String(d[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ data, colors }: {
  data: { name: string; value: number; color?: string }[];
  colors?: Record<string, string>;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumPct = 0;
  const segments = data.map(d => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const start = cumPct;
    cumPct += pct;
    return { ...d, pct, start };
  });

  const gradient = segments.map(s => {
    const c = s.color || colors?.[s.name] || "#666";
    return `${c} ${s.start}% ${s.start + s.pct}%`;
  }).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="w-40 h-40 rounded-full relative" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-6 rounded-full bg-[#141414] flex items-center justify-center">
          <span className="text-lg font-bold">{total}</span>
        </div>
      </div>
      <div className="space-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color || colors?.[s.name] || "#666" }} />
            <span className="text-xs text-gray-400">{s.name}: {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LineChart({ data, labelKey, valueKey, color = "#3b82f6" }: {
  data: any[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  if (!data.length) return null;
  const values = data.map(d => Number(d[valueKey]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const h = 160;
  const w = data.length > 1 ? 100 / (data.length - 1) : 100;

  const points = values.map((v, i) => {
    const x = i * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 100 ${h}`} className="w-full" preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="1" points={points} vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => {
          const x = i * w;
          const y = h - ((v - min) / range) * (h - 20) - 10;
          return <circle key={i} cx={x} cy={y} r="1.5" fill={color} />;
        })}
      </svg>
      <div className="flex justify-between mt-1">
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i} className="text-[9px] text-gray-500">{String(d[labelKey])}</span>
        ))}
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color || ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function ScoreBar({ label, value, max = 1, color = "#3b82f6" }: {
  label: string; value: number; max?: number; color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-32">{label}</span>
      <div className="flex-1 bg-[#1a1a1a] rounded-full h-4">
        <div className="h-4 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-14 text-right">{value.toFixed(3)}</span>
    </div>
  );
}
