// Lightweight inline SVG sparkline — area fill + line + emphasized endpoint.
export default function Sparkline({
  data, color = "var(--violet)", width = 220, height = 46,
}: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  const pts = data.length ? data : [0, 0];
  const n = pts.length;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const pad = 4;
  const x = (i: number) => (n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2));
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M ${x(0).toFixed(1)},${height} L ${pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L ")} L ${x(n - 1).toFixed(1)},${height} Z`;
  const lastX = x(n - 1), lastY = y(pts[n - 1]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="trend" className="max-w-full">
      <path d={area} fill={color} opacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
      <circle cx={lastX} cy={lastY} r={5.5} fill={color} opacity={0.18} />
    </svg>
  );
}
