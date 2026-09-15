import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { CHART_COLORS } from "@/config/constants";
import type { RiskTrendPoint } from "@/types/risk";

interface Props { data: RiskTrendPoint[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-mono text-[var(--color-text-2)] mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-mono" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export function RiskTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line type="monotone" dataKey="critical_count" name="Critical" stroke={CHART_COLORS.critical} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="high_count"     name="High"     stroke={CHART_COLORS.high}     strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="medium_count"   name="Medium"   stroke={CHART_COLORS.medium}   strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
