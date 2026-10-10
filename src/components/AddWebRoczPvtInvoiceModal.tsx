"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { todayIST } from "@/lib/india-date";
import { X, Plus } from "lucide-react";
import { addWebRoczPvtInvoice, getWebRoczPvtInvoiceDefaults, getWebRoczPvtNextInvoiceNumber, type PvtInvoiceResult, type WebRoczPvtInvoiceDefaults } from "@/app/webrocz-pvt-actions";
import { WEB_ROCZ_CLIENT_SERVICES, invoiceServiceNames, DM_LINE } from "@/lib/webrocz-services";

// Web Rocz Pvt Ltd (digital marketing, GST 18%) invoice — works like the Web Rocz invoice
// form (tick the services, one invoice amount, a known company ticks its saved services) but
// with the client GSTIN and GST worked out on top of the amount. Website services (Domain /
// Hosting + SSL / Website Designing) are not offered. Kept in its own file so the Web Rocz
// and Web Solutions invoice forms are never affected.
const PVT_SERVICES = WEB_ROCZ_CLIENT_SERVICES.map((x) => x.name);
const GST_PCT = 18;
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

// `lockClientName` is used from a client's own page (the company cannot be changed there).
export default function AddWebRoczPvtInvoiceModal({ clientNames, close, returnTo = "/invoices", lockClientName }: { clientNames: string[]; close: () => void; returnTo?: string; lockClientName?: string }) {
  const [name, setName] = useState(lockClientName ?? "");
  const today = todayIST(); // today in India
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [customs, setCustoms] = useState<string[]>([]);
  const [gstin, setGstin] = useState("");
  const [amount, setAmount] = useState("");
  // Invoice number: the next one in the Pvt Ltd series is suggested, and stays editable.
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  // Project date is remembered from the client's last invoice.
  const [projectDate, setProjectDate] = useState("");
  const [saved, save, saving] = useActionState<PvtInvoiceResult, FormData>(addWebRoczPvtInvoice, null);
  // Saved GSTIN + services per client (lower-cased name), loaded once when the form opens.
  const [defaults, setDefaults] = useState<WebRoczPvtInvoiceDefaults>({});
  // Once the accountant changes a tick / the GSTIN by hand, auto-fill never overwrites it.
  const svcEdited = useRef(false);
  const gstinEdited = useRef(false);
  const numberEdited = useRef(false);
  const projectEdited = useRef(false);
  const nameRef = useRef(name);

  const applyClient = (clientName: string, from: WebRoczPvtInvoiceDefaults) => {
    const c = from[clientName.trim().toLowerCase()];
    if (!gstinEdited.current) setGstin(c?.gstin ?? "");
    if (!projectEdited.current) setProjectDate(c?.projectDate ?? "");
    if (svcEdited.current) return;
    const names = (c?.services ?? []).map((x) => x.service);
    setOn(Object.fromEntries(names.filter((n) => PVT_SERVICES.includes(n)).map((n) => [n, true])));
    setCustoms(names.filter((n) => !PVT_SERVICES.includes(n)));
  };
  useEffect(() => {
    let alive = true;
    getWebRoczPvtInvoiceDefaults().then((d) => { if (!alive) return; setDefaults(d); applyClient(nameRef.current, d); }).catch(() => { /* form still works without auto-fill */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (numberEdited.current) return;
    let alive = true;
    getWebRoczPvtNextInvoiceNumber(issueDate).then((v) => { if (alive && !numberEdited.current && v) setNumber(v); }).catch(() => { /* typed by hand instead */ });
    return () => { alive = false; };
  }, [issueDate]);
  const pickName = (v: string) => { setName(v); nameRef.current = v; applyClient(v, defaults); };
  // Monthly counts saved for the picked client (e.g. "8 blogs/month · 25 keywords"), shown beside the service.
  const detailOf = (sv: string) => defaults[name.trim().toLowerCase()]?.services.find((x) => x.service === sv)?.detail ?? "";
  const tick = (sv: string, v: boolean) => { svcEdited.current = true; setOn((p) => ({ ...p, [sv]: v })); };
  const editCustoms = (fn: (cs: string[]) => string[]) => { svcEdited.current = true; setCustoms(fn); };

  // The invoice lists the services ticked / added here (first line carries the amount, GST is
  // added on top by the save action); with nothing chosen it carries one "Digital Marketing
  // Services" line.
  const picked = [...PVT_SERVICES.filter((k) => on[k]), ...customs.map((c) => c.trim()).filter(Boolean)];
  // Two linked boxes: type the amount before GST, or type the total with GST — the other one
  // follows. The total is what gets saved on the invoice, exactly as shown.
  const [gross, setGross] = useState("");
  const typeBase = (v: string) => { setAmount(v); const b = Math.max(0, Math.round(Number(v) || 0)); setGross(v === "" ? "" : String(b + Math.round((b * GST_PCT) / 100))); };
  const typeGross = (v: string) => { setGross(v); const g = Math.max(0, Math.round(Number(v) || 0)); setAmount(v === "" ? "" : String(Math.round((g * 100) / (100 + GST_PCT)))); };
  const total = Math.max(0, Math.round(Number(gross) || 0));
  const base = Math.max(0, Math.round(Number(amount) || 0));
  const gstAmount = Math.max(0, total - base);
  const [err, setErr] = useState("");
  // The button stays clickable; what is missing is explained instead of silently blocking.
  const problem = base <= 0 ? "Enter the invoice amount." : "";
  const check = (e: React.SyntheticEvent) => { if (problem) e.preventDefault(); setErr(problem); };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Add new invoice · Web Rocz Pvt Ltd</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Monthly digital marketing tax invoice · With GST {GST_PCT}%</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <form action={save} className="space-y-3 overflow-y-auto scroll-thin px-6 py-4">
          {picked.map((sv, i) => <input key={i} type="hidden" name="services" value={sv} />)}
          <datalist id="webrocz-pvt-inv-client-names">{clientNames.map((nm) => <option key={nm} value={nm} />)}</datalist>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Invoice number</span><input name="number" value={number} onChange={(e) => { setNumber(e.target.value); numberEdited.current = true; }} className="input mt-1" placeholder="e.g. 2026-27/163" /><span className="mt-1 block text-[11px] text-[var(--faint)]">Filled automatically — change it if needed.</span></label>
            <label className="block"><span className="eyebrow">Invoice date</span><input name="issueDate" type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Company name</span><input name="clientName" required list="webrocz-pvt-inv-client-names" value={name} onChange={(e) => pickName(e.target.value)} readOnly={!!lockClientName} className={"input mt-1" + (lockClientName ? " bg-[var(--surface-2)]" : "")} placeholder="Company / client" /></label>
            <label className="block"><span className="eyebrow">Project date</span><input name="projectDate" type="date" value={projectDate} onChange={(e) => { setProjectDate(e.target.value); projectEdited.current = true; }} className="input mt-1" /><span className="mt-1 block text-[11px] text-[var(--faint)]">The date the project started.</span></label>
          </div>
          <label className="block"><span className="eyebrow">Client GSTIN</span><input name="gstin" value={gstin} onChange={(e) => { setGstin(e.target.value); gstinEdited.current = true; }} className="input mt-1 uppercase" placeholder="e.g. 36AABCU9603R1ZM" /><span className="mt-1 block text-[11px] text-[var(--faint)]">Sets the place of supply (CGST/SGST vs IGST) on the tax invoice.</span></label>

          <div>
            <span className="eyebrow">Services</span>
            <div className="mt-1.5 space-y-2 rounded-[10px] border border-[var(--line)] p-3">
              {PVT_SERVICES.map((sv) => (
                <label key={sv} className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={on[sv] || false} onChange={(e) => tick(sv, e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> {sv}
                  {on[sv] && detailOf(sv) ? <span className="text-[11px] font-normal text-[var(--muted)]">· {detailOf(sv)}</span> : null}
                </label>
              ))}
              {customs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c} onChange={(e) => editCustoms((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))} className="input flex-1" placeholder="Other service" />
                  <button type="button" onClick={() => editCustoms((cs) => cs.filter((_, j) => j !== i))} title="Remove" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] border border-[var(--line-2)] text-[var(--rose)] hover:bg-[color-mix(in_srgb,var(--rose)_10%,white)]"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => editCustoms((cs) => [...cs, ""])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--violet)] hover:underline"><Plus size={13} /> Add service</button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">On the invoice: <b className="text-[var(--ink-2)]">{invoiceServiceNames(picked).join(", ") || DM_LINE}</b>{invoiceServiceNames(picked).length ? "" : " (nothing selected)"}</p>
          </div>

          <div className="rounded-[12px] border border-[var(--line-2)] px-4 py-3" style={{ background: "color-mix(in srgb, var(--violet) 6%, white)" }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Amount (₹) <span className="font-normal normal-case text-[var(--faint)]">before GST</span></span>
                <input name="amount" type="number" min={0} step="any" value={amount} onChange={(e) => { typeBase(e.target.value); setErr(""); }} className={"input mt-1.5 !text-[17px] !font-extrabold tnum" + (err && base <= 0 ? " !border-[var(--rose)]" : "")} placeholder="0" />
              </label>
              <label className="block">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Total (₹) <span className="font-normal normal-case text-[var(--faint)]">with GST</span></span>
                <input name="grandTotal" type="number" min={0} step="any" value={gross} onChange={(e) => { typeGross(e.target.value); setErr(""); }} className={"input mt-1.5 !text-[17px] !font-extrabold tnum" + (err && base <= 0 ? " !border-[var(--rose)]" : "")} placeholder="0" />
              </label>
            </div>
            <div className="mt-1.5 text-[11.5px] text-[var(--faint)]">Fill either box — the other is worked out. The invoice is saved with exactly the total shown.</div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--muted)]"><span>GST {GST_PCT}%</span><span className="tnum">{inr(gstAmount)}</span></div>
            <div className="mt-1.5 flex items-center justify-between border-t border-[var(--line)] pt-1.5"><span className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Invoice total</span><span className="text-[22px] font-extrabold tnum text-[var(--violet)]">{inr(total)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Amount received (optional)</span><input name="received" type="number" min={0} className="input mt-1" placeholder="0" /></label>
            <label className="block"><span className="eyebrow">Due date (optional)</span><input name="dueDate" type="date" className="input mt-1" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="eyebrow">Payment screenshot (optional)</span><input name="paymentProof" type="file" accept="image/*,.pdf" className="input mt-1 !py-1.5 text-[12px]" /></label>
            <label className="block"><span className="eyebrow">Invoice document (optional)</span><input name="invoiceDoc" type="file" accept="image/*,.pdf" className="input mt-1 !py-1.5 text-[12px]" /></label>
          </div>
          <label className="block"><span className="eyebrow">Description (optional)</span><input name="desc" className="input mt-1" placeholder="optional notes" /></label>
          <p className="rounded-[10px] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)]">→ <b>Web Rocz Pvt Ltd</b> · GST serial series</p>

          {(err || saved?.error) && <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold text-[var(--rose)]" style={{ background: "color-mix(in srgb, var(--rose) 8%, white)" }}>{err || saved?.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
            <button type="submit" onClick={check} disabled={saving} className="btn btn-violet disabled:opacity-60"><Plus size={15} /> {saving ? "Creating…" : "Create invoice"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
