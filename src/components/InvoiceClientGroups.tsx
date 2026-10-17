"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Clock, MessageSquarePlus, Pencil, Trash2, ExternalLink } from "lucide-react";
import WebRoczPvtFollowupModal from "@/components/WebRoczPvtFollowupModal";
import { companyLabel } from "@/lib/domain";
import { SIR_ROW, SirTag, followupRank } from "@/components/RajeshSirTag";

// The invoices list, grouped by client: one row per client with its totals; clicking the row
// opens all of that client's invoices underneath. Used for every billing company (Web Solutions,
// Web Rocz, Web Rocz Pvt Ltd) and for the all-companies list — there a client billed by two
// companies gets one row per company (`showCompany`).

/* eslint-disable @typescript-eslint/no-explicit-any */
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const fmtD = (iso: string) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return d ? `${d}-${m}-${y}` : iso; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (iso: string) => { const [y, m] = (iso || "").split("-"); return m ? `${MON[parseInt(m, 10) - 1] ?? m} ${y}` : "—"; };

type Props = { rows: any[]; hideApproval?: boolean; canDelete?: boolean; openAll?: boolean; showCompany?: boolean; onFollowup: (inv: any) => void; onDelete: (inv: any) => void };

export default function InvoiceClientGroups({ rows, hideApproval, canDelete, openAll, showCompany, onFollowup, onDelete }: Props) {
  // One group per client (by client id; an unlinked invoice groups under its bill-to name).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; clientId: string | null; company: string; name: string; sub: string; invoices: any[] }>();
    for (const r of rows) {
      const who = r.clientId || `name:${(r.billTo || "").trim().toLowerCase()}`;
      const key = showCompany ? `${who}|${r.company || ""}` : who;
      const g = map.get(key) ?? { key, clientId: r.clientId || null, company: r.company || "", name: r.billTo, sub: r.phone || r.email || "", invoices: [] as any[] };
      g.invoices.push(r);
      map.set(key, g);
    }
    return [...map.values()].map((g) => {
      const invoices = [...g.invoices].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1)); // newest first
      const total = invoices.reduce((s, i) => s + i.total, 0);
      const balance = invoices.reduce((s, i) => s + i.balance, 0);
      const pending = invoices.filter((i) => i.balance > 0).length;
      // the nearest follow-up date set on any of the client's invoices
      const nextFollowup = invoices.map((i) => i.nextFollowup).filter(Boolean).sort()[0] ?? "";
      return { ...g, invoices, total, balance, received: total - balance, pending, nextFollowup, first: invoices[invoices.length - 1]?.issueDate ?? "", last: invoices[0]?.issueDate ?? "" };
    }).sort((a, b) => followupRank(a.invoices[0]?.followupBy) - followupRank(b.invoices[0]?.followupBy) || (a.last < b.last ? 1 : -1));
  }, [rows, showCompany]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Client whose Follow-up popup (Phone / WhatsApp) is open.
  const [fuClient, setFuClient] = useState<{ id: string; name: string } | null>(null);
  const isOpen = (key: string) => open[key] ?? (!!openAll || groups.length === 1);
  const cols = hideApproval ? 8 : 9;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
            <th className="th">Client</th><th className="th">Invoices</th><th className="th">Period</th><th className="th !text-right">Total</th><th className="th !text-right">Received</th><th className="th !text-right">Balance</th><th className="th !pl-10">Payment</th>{!hideApproval && <th className="th">Approval</th>}<th className="th">Action</th>
          </tr></thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={cols} className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">No invoices found.</td></tr>}
            {groups.map((g) => {
              const shown = isOpen(g.key);
              const unapproved = g.invoices.filter((i) => !i.approved).length;
              return (
                <Fragment key={g.key}>
                  <tr onClick={() => setOpen((p) => ({ ...p, [g.key]: !shown }))} className="cursor-pointer border-b border-[var(--line)] hover:bg-[var(--surface-2)]" style={g.invoices[0]?.followupBy === "Rajesh Sir" ? SIR_ROW : undefined} title={shown ? "Hide invoices" : "Show all invoices of this client"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight size={15} className={`flex-none text-[var(--muted)] transition-transform ${shown ? "rotate-90" : ""}`} />
                        <div>
                          {g.clientId
                            ? <Link href={`/accounts/${g.clientId}${g.company ? `?company=${g.company}` : ""}`} onClick={(e) => e.stopPropagation()} title="Open this client's page (all invoices, payments, notes)" className="whitespace-nowrap font-bold text-[var(--violet)] hover:underline">{g.name}</Link>
                            : <div className="whitespace-nowrap font-bold text-[var(--ink)]">{g.name}</div>}
                          {g.invoices[0]?.followupBy === "Rajesh Sir" && <SirTag />}
                          {(g.sub || showCompany) && <div className="text-[11.5px] text-[var(--faint)]">{[showCompany && g.company ? companyLabel(g.company) : "", g.sub].filter(Boolean).join(" · ")}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[12px] font-bold tnum">{g.invoices.length}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-2)]">{g.first === g.last || monthOf(g.first) === monthOf(g.last) ? monthOf(g.last) : `${monthOf(g.first)} – ${monthOf(g.last)}`}</td>
                    <td className="px-4 py-3 text-right font-semibold tnum">{inr(g.total)}</td>
                    <td className="px-4 py-3 text-right tnum" style={{ color: "var(--emerald)" }}>{inr(g.received)}</td>
                    <td className="px-4 py-3 text-right font-semibold tnum" style={{ color: g.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(g.balance)}</td>
                    <td className="whitespace-nowrap py-3 pl-10 pr-4">
                      {g.pending > 0
                        ? <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ color: "var(--amber)", background: "color-mix(in srgb, var(--amber) 12%, white)" }}>{g.pending} pending</span>
                        : <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ color: "var(--emerald)", background: "color-mix(in srgb, var(--emerald) 12%, white)" }}>All received</span>}
                    </td>
                    {!hideApproval && <td className="px-4 py-3">
                      {unapproved === 0
                        ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--emerald)" }}><ShieldCheck size={13} /> Approved</span>
                        : <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--amber)" }}><Clock size={13} /> {unapproved} pending</span>}
                    </td>}
                    {/* Follow-up on the client itself (Phone / WhatsApp); a row with no linked client
                        falls back to the follow-up notes of its latest invoice. */}
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); if (g.clientId) setFuClient({ id: g.clientId, name: g.name }); else onFollowup(g.invoices[0]); }} title="Follow-up — Phone / WhatsApp" className="inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border border-[var(--line-2)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><MessageSquarePlus size={13} /> Follow-up{g.invoices[0]?.clientFollowupCount > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--violet)] px-1 text-[9px] font-bold text-white">{g.invoices[0].clientFollowupCount}</span>}</button>
                      {g.nextFollowup && <div className="mt-1 whitespace-nowrap text-[11px] font-bold text-[var(--rose)] tnum">next follow-up {fmtD(g.nextFollowup)}</div>}
                    </td>
                  </tr>
                  {shown && (
                    <tr className="border-b border-[var(--line)]">
                      <td colSpan={cols} className="bg-[var(--surface-2)] px-4 pb-4 pt-2">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{g.name} · {g.invoices.length} invoice{g.invoices.length === 1 ? "" : "s"}</span>
                          {g.clientId && <Link href={`/accounts/${g.clientId}${g.company ? `?company=${g.company}` : ""}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--violet)] hover:underline"><ExternalLink size={12} /> Open client page</Link>}
                        </div>
                        <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
                          <table className="w-full text-[12.5px]">
                            <thead><tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                              <th className="th">Invoice</th><th className="th">Date</th><th className="th !text-right">Total</th><th className="th !text-right">Received</th><th className="th !text-right">Balance</th><th className="th !pl-8">Payment</th>{!hideApproval && <th className="th">Approval</th>}<th className="th">Actions</th>
                            </tr></thead>
                            <tbody>
                              {g.invoices.map((r) => (
                                <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{r.number}</td>
                                  <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-2)]">{fmtD(r.issueDate)}</td>
                                  <td className="px-4 py-2.5 text-right tnum">{inr(r.total)}</td>
                                  <td className="px-4 py-2.5 text-right tnum">{inr(r.total - r.balance)}</td>
                                  <td className="px-4 py-2.5 text-right tnum" style={{ color: r.balance > 0 ? "var(--amber)" : "var(--emerald)" }}>{inr(r.balance)}</td>
                                  <td className="whitespace-nowrap py-2.5 pl-8 pr-4">{r.paymentStatus}</td>
                                  {!hideApproval && <td className="px-4 py-2.5">
                                    {r.approved
                                      ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--emerald)" }}><ShieldCheck size={13} /> Approved</span>
                                      : <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--amber)" }}><Clock size={13} /> Pending</span>}
                                  </td>}
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                      <button onClick={() => onFollowup(r)} title="Follow-ups" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><MessageSquarePlus size={13} /> Follow-up{r.followups?.length > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--violet)] px-1 text-[9px] font-bold text-white">{r.followups.length}</span>}</button>
                                      <Link href={`/invoices/${r.id}`} title="Open & edit invoice" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"><Pencil size={13} /> Edit</Link>
                                      {canDelete && <button onClick={() => onDelete(r)} title="Delete invoice" className="inline-flex items-center gap-1 rounded-[7px] border border-[var(--line-2)] px-2 py-1 text-[12px] font-semibold text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><Trash2 size={13} /> Delete</button>}
                                    </div>
                                    {r.nextFollowup && r.nextFollowup !== g.nextFollowup && <div className="mt-1 text-[11px] font-bold text-[var(--rose)] tnum">next follow-up {fmtD(r.nextFollowup)}</div>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {fuClient && <WebRoczPvtFollowupModal clientId={fuClient.id} name={fuClient.name} close={() => setFuClient(null)} />}
    </div>
  );
}
