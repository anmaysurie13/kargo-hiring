"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "#64748b" };

export function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="stage" width={110} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.stage} fill={["#6366f1", "#818cf8", "#10b981", "#f59e0b", "#94a3b8", "#f43f5e"][i % 6]} />)}
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#0f172a" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Histogram({ data, lineBucket, lineScore }: { data: { bucket: string; count: number }[]; lineBucket: string | null; lineScore: number | null }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -20 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        {lineBucket && (
          <ReferenceLine x={lineBucket} stroke="#f43f5e" strokeDasharray="4 3" strokeWidth={2} label={{ value: `line ≈ ${lineScore?.toFixed(1)}`, position: "top", fill: "#e11d48", fontSize: 11 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CriterionChart({ data }: { data: { name: string; avg: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 34 }}>
        <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} />
        <YAxis type="category" dataKey="name" width={170} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => Number(v).toFixed(2)} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="avg" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.avg >= 3.5 ? "#10b981" : d.avg >= 2.5 ? "#f59e0b" : "#f43f5e"} />)}
          <LabelList dataKey="avg" position="right" formatter={(v) => Number(v).toFixed(1)} style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
