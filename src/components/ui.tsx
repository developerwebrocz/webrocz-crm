import type { LucideIcon } from "lucide-react";
import { initials } from "@/lib/domain";

export function Avatar({ name, size = 38, className = "", tone }: { name: string; size?: number; className?: string; tone?: string }) {
  const bg = tone === "slate" ? { background: "var(--surface-3)", color: "var(--ink-2)" } : undefined;
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.36, borderRadius: size * 0.28, ...bg }} title={name}>
      {initials(name)}
    </span>
  );
}

export function Card({ children, className = "", pad = true, hover = false, style }: { children: React.ReactNode; className?: string; pad?: boolean; hover?: boolean; style?: React.CSSProperties }) {
  return <div className={`card ${pad ? "card-pad" : ""} ${hover ? "card-hover" : ""} ${className}`} style={style}>{children}</div>;
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function IconChip({ icon: Icon, tone = "violet", size = 38 }: { icon: LucideIcon; tone?: string; size?: number }) {
  return (
    <span className={`icon-chip chip-${tone}`} style={{ width: size, height: size }}>
      <Icon size={size * 0.5} strokeWidth={2} />
    </span>
  );
}

const BADGE: Record<string, string> = { emerald: "badge-emerald", amber: "badge-amber", rose: "badge-rose", violet: "badge-violet", slate: "badge-slate" };
export function Badge({ tone = "violet", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`badge ${BADGE[tone] ?? "badge-violet"}`}>{children}</span>;
}

const DOTC: Record<string, string> = { emerald: "var(--emerald)", amber: "var(--amber)", rose: "var(--rose)", violet: "var(--violet)", sky: "var(--sky)", magenta: "var(--magenta)", indigo: "var(--indigo)" };
export function Dot({ tone }: { tone: string }) {
  return <span className="dot" style={{ background: DOTC[tone] ?? DOTC.violet }} />;
}

export function Progress({ pct, tone = "violet" }: { pct: number; tone?: string }) {
  return (
    <div className="track">
      <span style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: DOTC[tone] ?? "var(--violet)" }} />
    </div>
  );
}

/** KPI stat card — icon chip, label, big number, caption. */
export function StatCard({
  icon, tone = "violet", label, value, sub, children, className = "",
}: {
  icon: LucideIcon; tone?: string; label: string; value: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className} hover>
      <div className="flex items-start justify-between">
        <span className="eyebrow">{label}</span>
        <IconChip icon={icon} tone={tone} size={36} />
      </div>
      <div className="mt-3 text-[34px] font-extrabold leading-none tracking-tight tnum">{value}</div>
      {sub && <div className="mt-2 text-[13px] text-[var(--muted)]">{sub}</div>}
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

const SVC: Record<string, string> = {
  SEO: "SEO", SMO: "SMO", VIDEO: "Video", META_ADS: "Meta", GOOGLE_ADS: "Google",
  CRM: "CRM", WEBSITE_DEV: "Web", BRANDING: "Brand", OTHER: "Other",
};
export function ServiceChips({ services, max = 3 }: { services: string[]; max?: number }) {
  const shown = services.slice(0, max);
  const extra = services.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => <span key={s} className="tag">{SVC[s] ?? s}</span>)}
      {extra > 0 && <span className="tag">+{extra}</span>}
    </div>
  );
}

export function LinkButton({ href, children, variant = "ghost", className = "" }: { href: string; children: React.ReactNode; variant?: "dark" | "ghost" | "violet"; className?: string }) {
  return <a href={href} className={`btn btn-${variant} ${className}`}>{children}</a>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
