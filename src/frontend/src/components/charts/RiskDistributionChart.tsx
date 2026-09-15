import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS } from "@/config/constants";

interface Props {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const SLICES = [
  { key: "critical", label: "Critical", color: CHART_COLORS.critical },
  { key: "high",     label: "High",     color: CHART_COLORS.high },
  { key: "medium",   label: "Medium",   color: CHART_COLORS.medium },
  { key: "low",      label: "Low",      color: CHART_COLORS.low },
] as const;

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-[var(--color-base-1)] border border-[var(--color-base-4)] rounded px-3 py-2 text-xs shadow-lg">
      <span className="font-mono text-[var(--color-text-1)]">{name}: <strong>{value}</strong></span>
    </div>
  );
};

const CustomLegend = ({ payload }: any) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
    {(payload ?? []).map((entry: any) => (
      <span key={entry.value} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-2)]">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
        {entry.value}
      </span>
    ))}
  </div>
);

export function RiskDistributionChart({ critical, high, medium, low }: Props) {
  const data = SLICES.map(s => ({
    name: s.label,
    value: { critical, high, medium, low }[s.key],
    color: s.color,
  })).filter(d => d.value > 0);

  const total = critical + high + medium + low;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-[var(--color-text-3)] text-sm">
        No equipment data
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ bottom: "28px" }}>
        <span className="font-mono font-bold text-[22px] text-[var(--color-text-0)]">{total}</span>
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-3)]">total</span>
      </div>
    </div>
  );
}
