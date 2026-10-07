"use client";

import { Megaphone, CalendarClock, Download } from "lucide-react";
import { useAccountManagers } from "@/components/WebRoczAccountManager";

// Two-column details box on a Web Rocz (digital marketing) client's page. Left: client data,
// services taken and the SLA download. Right: registration + the monthly renewal cycle.
// Web Rocz bills monthly, so the cycle runs from the latest invoice to one month after it.
// Web Solutions has its own box (domain / hosting / yearly renewal) in FinanceClientDetail.

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtDate = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split(" ")[0].split("-"); return d ? `${d}-${m}-${y}` : iso; };
// Same day next month, clamped to that month's last day (31 Jan → 28/29 Feb).
const addMonth = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
};
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);

type CardClient = { pocName: string | null; pocMobile: string | null; pocEmail: string | null; onboardDate: string; accountManagerId: string | null; monthlyRetainer?: number; billingDay?: number };
type CardInvoice = { issueDate: string; total: number; company: string };

export default function WebRoczClientCard({ client, services, slaUrl, invoices }: { client: CardClient; services: { service: string; detail: string | null }[]; slaUrl: string; invoices: CardInvoice[] }) {
  // The manager's name is looked up from the same list the Account manager dropdown uses.
  const managers = useAccountManagers();
  const managerName = !client.accountManagerId ? "—" : managers === null ? "…" : managers.find((m) => m.id === client.accountManagerId)?.name ?? "—";
  // This client's Web Rocz invoices, oldest → newest.
  const dated = invoices.filter((i) => i.company === "WEB_ROCZ" && i.issueDate).sort((a, b) => (a.issueDate < b.issueDate ? -1 : 1));
  const first = dated[0];
  const last = dated[dated.length - 1];
  const registerDate = first?.issueDate || client.onboardDate;
  const expiry = last ? addMonth(last.issueDate) : "";
  const today = new Date().toISOString().slice(0, 10);
  const left = expiry ? daysBetween(today, expiry) : 0;
  const status = !expiry ? null
    : left < 0 ? { text: `Expired ${-left} day${left === -1 ? "" : "s"} ago`, color: "var(--rose)" }
    : left <= 7 ? { text: left === 0 ? "Expires today" : `Expires in ${left} day${left === 1 ? "" : "s"}`, color: "var(--amber)" }
    : { text: `Active · ${left} days left`, color: "var(--emerald)" };
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Left — client data, services, SLA */}
      <div className="card card-pad">
        <h3 className="eyebrow mb-2.5 flex items-center gap-1.5"><Megaphone size={13} className="text-[var(--magenta)]" /> Client &amp; services</h3>
        <div className="text-[12.5px]">
          <Row label="Account manager" value={managerName} />
          <Row label="Contact person" value={client.pocName || "—"} />
          <Row label="Phone" value={client.pocMobile || "—"} />
          <Row label="Email" value={client.pocEmail || "—"} />
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] py-1.5">
            <span className="text-[12px] text-[var(--muted)]">Services</span>
            <span className="flex flex-wrap justify-end gap-1">
              {services.length ? services.map((s) => (
                <span key={s.service} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">{s.service}{s.detail ? <span className="font-normal text-[var(--muted)]"> · {s.detail}</span> : null}</span>
              )) : <span className="font-semibold">—</span>}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-[12px] text-[var(--muted)]">SLA</span>
            {slaUrl
              ? <a href={slaUrl} download className="btn btn-violet btn-sm"><Download size={13} /> Download SLA</a>
              : <span className="font-semibold">—</span>}
          </div>
        </div>
      </div>
      {/* Right — registration & monthly renewal */}
      <div className="card card-pad">
        <h3 className="eyebrow mb-2.5 flex items-center gap-1.5"><CalendarClock size={13} className="text-[var(--magenta)]" /> Registration &amp; monthly renewal</h3>
        <div className="text-[12.5px]">
          <Row label="Register date" value={fmtDate(registerDate)} />
          <Row label="Billing cycle" value="Monthly" />
          <Row label="Invoice date" value={client.billingDay ? String(client.billingDay) : "—"} />
          <Row label="Last invoice" value={last ? fmtDate(last.issueDate) : "—"} />
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5">
            <span className="text-[12px] text-[var(--muted)]">Expiry date <span className="text-[var(--faint)]">(auto · +1 month)</span></span>
            <span className="flex flex-none items-center gap-2">
              {status && <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color: status.color, background: `color-mix(in srgb, ${status.color} 12%, white)` }}>{status.text}</span>}
              <span className="whitespace-nowrap font-semibold text-[var(--ink)]">{fmtDate(expiry)}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-2" style={{ background: "color-mix(in srgb, var(--magenta) 6%, white)" }}>
            <span className="text-[12px] font-semibold text-[var(--muted)]">Monthly amount</span>
            {/* latest invoice; before the first invoice, the agreed monthly amount on the client */}
            <span className="text-[15px] font-extrabold tnum text-[var(--magenta)]">{last ? inr(last.total) : client.monthlyRetainer ? inr(client.monthlyRetainer) : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5">
      <span className="text-[12px] text-[var(--muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}
