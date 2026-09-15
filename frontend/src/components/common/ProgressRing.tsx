interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function scoreToColor(score: number): string {
  if (score >= 75) return "#EF4444";
  if (score >= 50) return "#F59E0B";
  if (score >= 25) return "#EAB308";
  return "#10B981";
}

export function ProgressRing({ score, size = 72, strokeWidth = 6 }: Props) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreToColor(score);
  return (
    <svg width={size} height={size} aria-label={`Grid health score: ${score}`} role="img">
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-base-4)" strokeWidth={strokeWidth} />
      {/* Arc */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        className="font-mono font-bold" fill={color}
        fontSize={size < 80 ? 18 : 28} fontWeight={700} fontFamily="JetBrains Mono, monospace">
        {Math.round(score)}
      </text>
    </svg>
  );
}
