"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

type Series = { dataKey: string; label: string };

export function SimpleLine({
  title,
  data,
  xKey,
  series,
  height = 300
}: {
  title: string;
  data: any[];
  xKey: string;
  series: Series[];
  height?: number;
}) {
  const fmtTime = (iso: string) => (iso ? iso.slice(11, 16) : "");

  return (
    <>
      <h3 style={{ margin: "0 0 8px 0" }}>{title}</h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tickFormatter={fmtTime} />
            <YAxis />
            <Tooltip labelFormatter={(v) => v} />
            <Legend />
            {series.map((s) => (
              <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.label} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
