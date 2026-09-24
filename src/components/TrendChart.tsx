// Pure-SVG area chart — no external libs. Renders a smooth daily-output trend.
export default function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 760, H = 220, padX = 8, padTop = 16, padBottom = 26;
  const pts = data.length ? data : [{ label: "", value: 0 }];
  const max = Math.max(4, ...pts.map((p) => p.value));
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const x = (i: number) => padX + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / max) * innerH;

  // smooth path (cardinal-ish via quadratic midpoints)
  const line = pts.map((p, i) => [x(i), y(p.value)] as const);
  let d = `M ${line[0][0]},${line[0][1]}`;
  for (let i = 1; i < line.length; i++) {
    const [px, py] = line[i - 1];
    const [cx, cy] = line[i];
    const mx = (px + cx) / 2;
    d += ` Q ${px},${py} ${mx},${(py + cy) / 2} T ${cx},${cy}`;
  }
  const area = `${d} L ${x(pts.length - 1)},${padTop + innerH} L ${x(0)},${padTop + innerH} Z`;

  const peak = pts.reduce((a, b, i) => (b.value > pts[a].value ? i : a), 0);
  const gridY = [0, 0.5, 1].map((f) => padTop + innerH - f * innerH);
  const labelEvery = Math.ceil(pts.length / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="none" role="img" aria-label="Daily output trend">
      <defs>
        <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridY.map((gy, i) => (
        <line key={i} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 2 ? "0" : "3 4"} />
      ))}
      <path d={area} fill="url(#trendfill)" />
      <path d={d} fill="none" stroke="var(--violet)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* peak marker */}
      <circle cx={x(peak)} cy={y(pts[peak].value)} r="4" fill="var(--violet)" stroke="white" strokeWidth="2" />
      {pts.map((p, i) => (i % labelEvery === 0 || i === pts.length - 1) ? (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--faint)">{p.label}</text>
      ) : null)}
    </svg>
  );
}
