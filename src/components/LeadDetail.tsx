"use client";

import { useState } from "react";
import {
  setLeadStage, updateLead, saveFollowup, setFollowupStatus, saveQuotation,
  saveMeeting, saveReminder, onboardLead, markLost, reassignLead, addLeadNote, updateQuotation, deleteLead,
} from "@/app/sales-actions";
import {
  SALES_STAGES, SALES_STAGE_KEYS, SALES_STAGE_TONE, FOLLOWUP_TYPES, FOLLOWUP_STATUS,
  QUOTE_STATUS, MEETING_TYPES, LOST_REASONS, SERVICE_GROUPS,
  LEAD_SOURCES, serviceGroupsFor, serviceKind,
} from "@/lib/domain";
import Link from "next/link";
import { X, Phone, Mail, MessageCircle, CheckCircle2, Ban, ArrowLeft, Pencil, FileText } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Lead = any;
const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
const TABS = ["Notes", "Follow-ups", "Requirements", "Quotation", "Reminder", "Meeting", "Activity"] as const;
// Each stage is its own pipeline — inside a lead we only show Notes + the tab that matches
// the current stage, so it stays clean (a Quotation lead shows just Notes + Quotation).
const STAGE_TABS: Record<string, (typeof TABS)[number][]> = {
  POSITIVE_LEAD: ["Notes", "Requirements", "Follow-ups", "Activity"],
  FOLLOW_UP: ["Notes", "Requirements", "Follow-ups", "Activity"],
  QUOTATION: ["Notes", "Requirements", "Quotation", "Activity"],
  REMINDER: ["Notes", "Requirements", "Reminder", "Activity"],
  MEETING: ["Notes", "Requirements", "Meeting", "Activity"],
  ONBOARDED: ["Notes", "Requirements", "Activity"],
  LOST: ["Notes", "Requirements", "Activity"],
};

// Plain-language "what to do next" for each stage — keeps the flow obvious for the user.
const STAGE_HINT: Record<string, { step: string; tab?: (typeof TABS)[number] }> = {
  POSITIVE_LEAD: { step: "New lead. Add a Follow-up to start the conversation.", tab: "Follow-ups" },
  FOLLOW_UP: { step: "Keep following up. Capture requirements, then create a Quotation.", tab: "Follow-ups" },
  INTERESTED: { step: "Interested. Note requirements, then create a Quotation.", tab: "Requirements" },
  QUOTATION: { step: "Quotation stage. Create/upload the quotation and mark it Shared. Then set a Reminder or schedule a Meeting.", tab: "Quotation" },
  REMINDER: { step: "Reminder set to follow up. Schedule a Meeting, or Onboard when ready.", tab: "Reminder" },
  MEETING: { step: "Meeting / visit scheduled. When confirmed, click Onboard — or mark Lost.", tab: "Meeting" },
  ONBOARDED: { step: "Onboarded — the internal project has been created automatically. Nothing more to do here.", tab: "Activity" },
  LOST: { step: "This lead is Lost. It's kept for history and reporting.", tab: "Activity" },
};

export default function LeadDetail({ lead, execs, developers = [], dmPeople = [], canManage, isAdmin, openModal = "" }: { lead: Lead; execs: { id: string; name: string }[]; developers?: { id: string; name: string; role: string }[]; dmPeople?: { id: string; name: string; role: string }[]; canManage: boolean; isAdmin: boolean; openModal?: "" | "onboard" | "lost" }) {
  // Open straight to the tab that matches the lead's stage — e.g. a Quotation-stage lead
  // opens on the Quotation tab, a Meeting-stage lead on Meeting, etc.
  const DEFAULT_TAB: Record<string, (typeof TABS)[number]> = {
    POSITIVE_LEAD: "Notes", FOLLOW_UP: "Follow-ups", QUOTATION: "Quotation",
    REMINDER: "Reminder", MEETING: "Meeting", ONBOARDED: "Activity", LOST: "Activity",
  };
  const [tab, setTab] = useState<(typeof TABS)[number]>(DEFAULT_TAB[lead.stage] ?? "Notes");
  const [modal, setModal] = useState<"" | "onboard" | "lost" | "edit">(openModal || "");
  const tone = SALES_STAGE_TONE[lead.stage] ?? "var(--muted)";
  const svc: string[] = lead.servicesArr ?? [];

  return (
    <div className="space-y-5">
      <Link href="/sales" prefetch className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back to pipeline</Link>

      {/* what-to-do-next guidance */}
      {STAGE_HINT[lead.stage] && (
        <div className="flex items-center gap-3 rounded-[12px] border px-4 py-3" style={{ borderColor: `color-mix(in srgb, ${tone} 30%, white)`, background: `color-mix(in srgb, ${tone} 6%, white)` }}>
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: tone }}>→</span>
          <div className="text-[13px] text-[var(--ink-2)]"><b>Next step:</b> {STAGE_HINT[lead.stage].step}</div>
          {STAGE_HINT[lead.stage].tab && <button onClick={() => setTab(STAGE_HINT[lead.stage].tab!)} className="btn btn-ghost btn-sm ml-auto flex-none">Open</button>}
        </div>
      )}

      {/* header */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-extrabold tracking-tight">{lead.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: `color-mix(in srgb, ${tone} 12%, white)`, color: tone }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />{SALES_STAGES[lead.stage as keyof typeof SALES_STAGES] ?? lead.stage}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--faint)]">{lead.code}{lead.company ? ` · ${lead.company}` : ""} · Owner {lead.assignedTo?.name ?? "—"}</div>
            <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-[var(--ink-2)]">
              {lead.contactPerson && <span>{lead.contactPerson}</span>}
              {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5"><Phone size={13} /> {lead.phone}</a>}
              {lead.whatsapp && <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5"><MessageCircle size={13} /> {lead.whatsapp}</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5"><Mail size={13} /> {lead.email}</a>}
            </div>
            {svc.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{svc.map((x) => <span key={x} className="tag">{x}</span>)}</div>}
            {(() => {
              const lastNote = (lead.activities ?? []).find((a: any) => a.action === "Note");
              return lastNote ? (
                <button onClick={() => setTab("Notes")} className="mt-2.5 flex max-w-[520px] items-start gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left text-[12px] hover:border-[var(--violet)]">
                  <span className="font-semibold text-[var(--faint)]">Last note:</span>
                  <span className="line-clamp-2 text-[var(--ink-2)]">{lastNote.detail}</span>
                </button>
              ) : null;
            })()}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Lead value</div>
              <div className="text-[24px] font-extrabold tnum">{inr(lead.value)}</div>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <button onClick={() => setModal("edit")} className="btn btn-ghost btn-sm"><Pencil size={13} /> Edit lead</button>
                <form action={deleteLead} onSubmit={(e) => { if (!confirm(`Delete lead "${lead.name}"? This permanently removes the lead and cannot be undone.`)) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--rose)" }}><X size={13} /> Delete</button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* stage controls */}
        {canManage && lead.stage !== "LOST" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
            <form action={setLeadStage} className="flex items-center gap-2">
              <input type="hidden" name="id" value={lead.id} />
              <span className="eyebrow">Move stage</span>
              <select name="stage" defaultValue={lead.stage} onChange={(e) => { if (e.target.value === "ONBOARDED") { e.target.value = lead.stage; setModal("onboard"); } else if (e.target.value === "LOST") { e.target.value = lead.stage; setModal("lost"); } }} className="select !w-auto">{SALES_STAGE_KEYS.map((k) => <option key={k} value={k}>{SALES_STAGES[k]}</option>)}</select>
              <button className="btn btn-ghost btn-sm">Update</button>
            </form>
            {isAdmin && (
              <form action={reassignLead} className="flex items-center gap-2">
                <input type="hidden" name="id" value={lead.id} />
                <span className="eyebrow">Owner</span>
                <select name="assignedToId" defaultValue={lead.assignedToId ?? ""} className="select !w-auto">{execs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <button className="btn btn-ghost btn-sm">Reassign</button>
              </form>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setModal("onboard")} className="btn btn-violet btn-sm"><CheckCircle2 size={14} /> Onboard</button>
              <button onClick={() => setModal("lost")} className="btn btn-ghost btn-sm" style={{ color: "var(--rose)" }}><Ban size={14} /> Mark Lost</button>
            </div>
          </div>
        )}
        {lead.stage === "LOST" && <div className="mt-4 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--rose)_5%,white)] p-3 text-[12.5px]"><b style={{ color: "var(--rose)" }}>Lost</b> · {lead.lostReason || "—"}{lead.lostNotes ? ` — ${lead.lostNotes}` : ""} {lead.lostDate ? `(${lead.lostDate})` : ""}</div>}
        {lead.stage === "ONBOARDED" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--emerald)_5%,white)] p-3 text-[12.5px]">
            <span><b style={{ color: "var(--emerald)" }}>Onboarded</b> · {inr(lead.finalAmount)} · {lead.paymentStatus || "—"} · start {lead.startDate || "—"} · internal projects created.</span>
            <Link href={`/sales/${lead.id}/invoice`} prefetch className="btn btn-violet btn-sm ml-auto"><FileText size={14} /> Invoice</Link>
          </div>
        )}
      </div>

      {/* tabs — only Notes + the current stage's tab */}
      <div className="flex flex-wrap gap-1.5">
        {(STAGE_TABS[lead.stage] ?? [...TABS]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${tab === t ? "bg-[var(--ink)] text-white" : "border border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>{t}</button>)}
      </div>

      {tab === "Notes" && <NotesTab lead={lead} canManage={canManage} />}
      {tab === "Follow-ups" && <FollowupsTab lead={lead} canManage={canManage} />}
      {tab === "Requirements" && <InterestedTab lead={lead} execs={execs} canManage={canManage} svc={svc} />}
      {tab === "Quotation" && <QuotationTab lead={lead} canManage={canManage} />}
      {tab === "Reminder" && <ReminderTab lead={lead} canManage={canManage} />}
      {tab === "Meeting" && <MeetingTab lead={lead} canManage={canManage} />}
      {tab === "Activity" && <ActivityTab lead={lead} />}

      {modal === "onboard" && <OnboardModal lead={lead} developers={developers} dmPeople={dmPeople} close={() => setModal("")} />}
      {modal === "lost" && <LostModal lead={lead} close={() => setModal("")} />}
      {modal === "edit" && <EditModal lead={lead} svc={svc} close={() => setModal("")} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card !p-0 overflow-hidden"><div className="border-b border-[var(--line)] px-5 py-3"><h3 className="text-[14px] font-bold">{title}</h3></div><div className="p-5">{children}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow">{label}</span><div className="mt-1.5">{children}</div></label>;
}

function fmtWhen(v: any) {
  try { const d = new Date(v); return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(v ?? ""); }
}
function NotesTab({ lead, canManage }: { lead: Lead; canManage: boolean }) {
  const notes = (lead.activities ?? []).filter((a: any) => a.action === "Note");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && (
        <Card title="Add note">
          <form action={addLeadNote} className="space-y-3"><input type="hidden" name="leadId" value={lead.id} />
            <textarea name="note" required rows={4} placeholder="e.g. Called client, interested in website + SEO. Wants a call next week." className="textarea" />
            <div className="grid gap-3 sm:grid-cols-3">
              <F label="Remind me on"><input name="remindDate" type="date" className="input" /></F>
              <F label="Time"><input name="remindTime" type="time" className="input" /></F>
              <F label="Reminder type"><select name="remindType" className="select"><option>Call</option><option>WhatsApp</option><option>Email</option><option>Visit</option><option>Meeting</option></select></F>
            </div>
            <div className="flex justify-end"><button className="btn btn-violet">Save note</button></div>
          </form>
          <p className="mt-2 text-[11.5px] text-[var(--faint)]">Every note is kept — old notes are never erased. Add a <b>Remind me on</b> date and it shows in <b>Reminders due</b> on that day.</p>
        </Card>
      )}
      <Card title={`Notes history (${notes.length})`}>
        <div className="space-y-2.5">
          {notes.length === 0 && !lead.notes && <div className="text-[13px] text-[var(--muted)]">No notes yet. Add the first one.</div>}
          {notes.map((nt: any) => (
            <div key={nt.id} className="rounded-[10px] border border-[var(--line)] p-3">
              <div className="flex items-center justify-between text-[11.5px]"><span className="font-semibold text-[var(--ink-2)]">{nt.actor}</span><span className="text-[var(--faint)]">{fmtWhen(nt.createdAt)}</span></div>
              <div className="mt-1 whitespace-pre-wrap text-[13px]">{nt.detail}</div>
            </div>
          ))}
          {lead.notes && <div className="rounded-[10px] border border-dashed border-[var(--line-2)] p-3"><div className="text-[11.5px] font-semibold text-[var(--faint)]">Original note (at creation)</div><div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{lead.notes}</div></div>}
        </div>
      </Card>
    </div>
  );
}

function FollowupsTab({ lead, canManage }: { lead: Lead; canManage: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && <Card title="Add follow-up"><form action={saveFollowup} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="leadId" value={lead.id} />
        <F label="Date"><input type="date" name="date" className="input" /></F>
        <F label="Time"><input type="time" name="time" className="input" /></F>
        <F label="Type"><select name="type" className="select">{FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
        <F label="Status"><select name="status" className="select">{Object.entries(FOLLOWUP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <div className="sm:col-span-2"><F label="Notes"><textarea name="notes" rows={2} className="textarea" /></F></div>
        <F label="Next follow-up date"><input type="date" name="nextDate" className="input" /></F>
        <F label="Next time"><input type="time" name="nextTime" className="input" /></F>
        <div className="sm:col-span-2 flex justify-end"><button className="btn btn-violet">Save follow-up</button></div>
      </form></Card>}
      <Card title={`History (${lead.followups.length})`}>
        <div className="space-y-2.5">
          {lead.followups.length === 0 && <div className="text-[13px] text-[var(--muted)]">No follow-ups yet.</div>}
          {lead.followups.map((f: any) => {
            const overdue = f.status === "PENDING" && f.date && f.date < today;
            return (
              <div key={f.id} className={`rounded-[10px] border p-3 ${overdue ? "border-[color-mix(in_srgb,var(--rose)_40%,white)] bg-[color-mix(in_srgb,var(--rose)_5%,white)]" : "border-[var(--line)]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold">{f.type} · {f.date || "—"} {f.time}</div>
                  <span className="badge badge-slate">{FOLLOWUP_STATUS[f.status as keyof typeof FOLLOWUP_STATUS] ?? f.status}{overdue ? " · overdue" : ""}</span>
                </div>
                {f.notes && <div className="mt-1 text-[12px] text-[var(--muted)]">{f.notes}</div>}
                {f.nextDate && <div className="mt-1 text-[11.5px] text-[var(--faint)]">Next: {f.nextDate} {f.nextTime}</div>}
                {canManage && f.status === "PENDING" && (
                  <div className="mt-2 flex gap-1.5">
                    {(["COMPLETED", "RESCHEDULED", "NO_RESPONSE"] as const).map((st) => (
                      <form key={st} action={setFollowupStatus}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="leadId" value={lead.id} /><input type="hidden" name="status" value={st} /><button className="rounded-md border border-[var(--line-2)] px-2 py-1 text-[11px] font-semibold hover:border-[var(--ink)]">{FOLLOWUP_STATUS[st]}</button></form>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function InterestedTab({ lead, canManage }: { lead: Lead; execs: any; canManage: boolean; svc: string[] }) {
  return (
    <Card title="Interested — requirements & qualification">
      {canManage ? (
        <form action={updateLead} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={lead.id} />
          <div className="sm:col-span-2"><F label="Confirmed / Client requirements"><textarea name="requirements" defaultValue={lead.requirements} rows={3} className="textarea" /></F></div>
          <F label="Budget (₹)"><input type="number" name="budget" defaultValue={lead.budget || ""} className="input" /></F>
          <F label="Expected start date"><input type="date" name="expectedStart" defaultValue={lead.expectedStart} className="input" /></F>
          <F label="Decision maker"><input name="decisionMaker" defaultValue={lead.decisionMaker} className="input" /></F>
          <F label="Timeline"><input name="timeline" defaultValue={lead.timeline} className="input" /></F>
          <div className="sm:col-span-2"><F label="Next action"><input name="nextAction" defaultValue={lead.nextAction} className="input" /></F></div>
          {/* keep existing basics */}
          <input type="hidden" name="name" value={lead.name} /><input type="hidden" name="company" value={lead.company} />
          <input type="hidden" name="contactPerson" value={lead.contactPerson} /><input type="hidden" name="phone" value={lead.phone} />
          <input type="hidden" name="whatsapp" value={lead.whatsapp} /><input type="hidden" name="email" value={lead.email} />
          <input type="hidden" name="source" value={lead.source} /><input type="hidden" name="value" value={lead.value} /><input type="hidden" name="notes" value={lead.notes} />
          <div className="sm:col-span-2 flex justify-end"><button className="btn btn-violet">Save</button></div>
        </form>
      ) : <div className="text-[13px] text-[var(--muted)]">{lead.requirements || "No requirements captured."}</div>}
    </Card>
  );
}

function QuotationTab({ lead, canManage }: { lead: Lead; canManage: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && <Card title="Create quotation"><form action={saveQuotation} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="leadId" value={lead.id} />
        {/* Upload the quotation file — the main thing, shown first */}
        <div className="sm:col-span-2 rounded-[10px] border-2 border-dashed border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_5%,white)] p-3">
          <F label="📎 Upload quotation file (PDF / Word / Excel / image)">
            <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="input !py-2 bg-white" />
          </F>
        </div>
        <F label="Quotation No."><input name="number" placeholder="auto" className="input" /></F>
        <F label="Services"><input name="services" defaultValue={(lead.servicesArr ?? []).join(", ")} className="input" /></F>
        <F label="Amount (₹)"><input type="number" name="amount" className="input" /></F>
        <F label="Tax (₹)"><input type="number" name="tax" className="input" /></F>
        <F label="Final Amount (₹)"><input type="number" name="finalAmount" className="input" /></F>
        <F label="Status (Shared / Not Shared)"><select name="status" className="select">{Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <F label="Date"><input type="date" name="date" className="input" /></F>
        <F label="Valid until"><input type="date" name="validUntil" className="input" /></F>
        <div className="sm:col-span-2 flex justify-end"><button className="btn btn-violet">Save quotation</button></div>
      </form></Card>}
      <Card title={`Quotations (${lead.quotations.length})`}><div className="space-y-2.5">{lead.quotations.length === 0 && <div className="text-[13px] text-[var(--muted)]">None yet.</div>}{lead.quotations.map((qq: any) => (
        <QuotationRow key={qq.id} qq={qq} leadId={lead.id} canManage={canManage} />
      ))}</div></Card>
    </div>
  );
}

function QuotationRow({ qq, leadId, canManage }: { qq: any; leadId: string; canManage: boolean }) {
  const [edit, setEdit] = useState(false);
  if (edit && canManage) {
    return (
      <form action={updateQuotation} className="grid gap-2.5 rounded-[10px] border border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_4%,white)] p-3 sm:grid-cols-2">
        <input type="hidden" name="leadId" value={leadId} /><input type="hidden" name="quotationId" value={qq.id} />
        <F label="Quotation No."><input name="number" defaultValue={qq.number} className="input" /></F>
        <F label="Services"><input name="services" defaultValue={qq.services ?? ""} className="input" /></F>
        <F label="Amount (₹)"><input type="number" name="amount" defaultValue={qq.amount} className="input" /></F>
        <F label="Tax (₹)"><input type="number" name="tax" defaultValue={qq.tax} className="input" /></F>
        <F label="Final Amount (₹)"><input type="number" name="finalAmount" defaultValue={qq.finalAmount} className="input" /></F>
        <F label="Status"><select name="status" defaultValue={qq.status} className="select">{Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <F label="Date"><input type="date" name="date" defaultValue={qq.date ?? ""} className="input" /></F>
        <F label="Valid until"><input type="date" name="validUntil" defaultValue={qq.validUntil ?? ""} className="input" /></F>
        <div className="sm:col-span-2"><F label="Re-upload file (PDF / image)"><input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="input !py-1.5" /></F></div>
        <div className="sm:col-span-2"><F label="…or paste a link"><input name="fileUrl" defaultValue={qq.fileUrl ?? ""} placeholder="Drive / PDF link" className="input" /></F></div>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setEdit(false)} className="btn btn-ghost btn-sm">Cancel</button><button className="btn btn-violet btn-sm">Save changes</button></div>
      </form>
    );
  }
  return (
    <div className="rounded-[10px] border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{qq.number} · {inr(qq.finalAmount)}</span>
        <span className="badge badge-violet">{QUOTE_STATUS[qq.status as keyof typeof QUOTE_STATUS] ?? qq.status}</span>
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--faint)]">{qq.date} {qq.validUntil ? `· valid ${qq.validUntil}` : ""}</div>
      <div className="mt-1.5 flex items-center gap-3">
        {qq.fileUrl && <a href={qq.fileUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[var(--violet)]">📎 Open file</a>}
        {canManage && <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-2)] hover:text-[var(--violet)]"><Pencil size={12} /> Edit</button>}
      </div>
    </div>
  );
}

function ReminderTab({ lead, canManage }: { lead: Lead; canManage: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && <Card title="Set reminder"><form action={saveReminder} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="leadId" value={lead.id} />
        <F label="Date"><input type="date" name="date" className="input" /></F>
        <F label="Time"><input type="time" name="time" className="input" /></F>
        <F label="Type"><select name="type" className="select">{FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
        <F label="Next action"><input name="nextAction" className="input" /></F>
        <div className="sm:col-span-2"><F label="Notes"><textarea name="notes" rows={2} className="textarea" /></F></div>
        <div className="sm:col-span-2 flex justify-end"><button className="btn btn-violet">Save reminder</button></div>
      </form></Card>}
      <Card title={`Reminders (${lead.reminders.length})`}><div className="space-y-2.5">{lead.reminders.length === 0 && <div className="text-[13px] text-[var(--muted)]">None yet.</div>}{lead.reminders.map((r: any) => (
        <div key={r.id} className="rounded-[10px] border border-[var(--line)] p-3"><div className="text-[13px] font-semibold">{r.type} · {r.date} {r.time}</div>{r.notes && <div className="mt-1 text-[12px] text-[var(--muted)]">{r.notes}</div>}{r.nextAction && <div className="mt-1 text-[11.5px] text-[var(--faint)]">Next: {r.nextAction}</div>}</div>
      ))}</div></Card>
    </div>
  );
}

function MeetingTab({ lead, canManage }: { lead: Lead; canManage: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canManage && <Card title="Schedule meeting / visit"><form action={saveMeeting} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="leadId" value={lead.id} />
        <div className="sm:col-span-2"><F label="Meeting type"><select name="type" className="select">{Object.entries(MEETING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F></div>
        <F label="Date"><input type="date" name="date" className="input" /></F>
        <F label="Time"><input type="time" name="time" className="input" /></F>
        <F label="Meeting person"><input name="person" className="input" /></F>
        <F label="Meeting link"><input name="link" placeholder="Google Meet / Zoom" className="input" /></F>
        <div className="sm:col-span-2"><F label="Location"><input name="location" className="input" /></F></div>
        <div className="sm:col-span-2"><F label="Notes"><textarea name="notes" rows={2} className="textarea" /></F></div>
        <F label="Outcome"><input name="outcome" className="input" /></F>
        <F label="Next action"><input name="nextAction" className="input" /></F>
        <div className="sm:col-span-2 flex justify-end"><button className="btn btn-violet">Save meeting</button></div>
      </form></Card>}
      <Card title={`Meetings (${lead.meetings.length})`}><div className="space-y-2.5">{lead.meetings.length === 0 && <div className="text-[13px] text-[var(--muted)]">None yet.</div>}{lead.meetings.map((m: any) => (
        <div key={m.id} className="rounded-[10px] border border-[var(--line)] p-3"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold">{MEETING_TYPES[m.type as keyof typeof MEETING_TYPES] ?? m.type}</span><span className="text-[11.5px] text-[var(--faint)] tnum">{m.date} {m.time}</span></div>{m.person && <div className="mt-1 text-[12px] text-[var(--muted)]">With {m.person}</div>}{m.link && <a href={m.link} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[var(--violet)]">Join link</a>}{m.location && <div className="text-[11.5px] text-[var(--faint)]">{m.location}</div>}{m.outcome && <div className="mt-1 text-[12px]">Outcome: {m.outcome}</div>}</div>
      ))}</div></Card>
    </div>
  );
}

function ActivityTab({ lead }: { lead: Lead }) {
  return (
    <Card title="Activity timeline">
      <div className="space-y-3">
        {lead.activities.length === 0 && <div className="text-[13px] text-[var(--muted)]">No activity yet.</div>}
        {lead.activities.map((a: any) => (
          <div key={a.id} className="flex gap-3">
            <span className="mt-1 h-2 w-2 flex-none rounded-full bg-[var(--violet)]" />
            <div><div className="text-[13px] font-semibold">{a.action}</div><div className="text-[11.5px] text-[var(--faint)]">{a.actor} · {new Date(a.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{a.detail ? ` · ${a.detail}` : ""}</div></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OnboardModal({ lead, developers, dmPeople, close }: { lead: Lead; developers: { id: string; name: string; role: string }[]; dmPeople: { id: string; name: string; role: string }[]; close: () => void }) {
  const k = serviceKind(lead.servicesArr ?? []);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4"><div><h2 className="text-[16px] font-bold">Onboarding Confirmation</h2><p className="text-[12px] text-[var(--muted)]">Saving creates the client + internal project(s) automatically.</p></div><button onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button></div>
        <form action={onboardLead} className="flex flex-col gap-3 overflow-y-auto p-6 scroll-thin"><input type="hidden" name="id" value={lead.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Final client name"><input name="company" defaultValue={lead.company || lead.name} className="input" /></F>
            <F label="Contact person"><input name="contactPerson" defaultValue={lead.contactPerson} className="input" /></F>
            <F label="Phone"><input name="phone" defaultValue={lead.phone} className="input" /></F>
            <F label="Email"><input name="email" defaultValue={lead.email} className="input" /></F>
            <F label="Final project / package amount (₹)"><input type="number" name="finalAmount" defaultValue={lead.value || ""} className="input" /></F>
            <F label="Payment status"><select name="paymentStatus" className="select"><option>Pending</option><option>Advance Paid</option><option>Fully Paid</option></select></F>
            <F label="GST on invoice"><select name="gst" defaultValue="1" className="select"><option value="1">With GST 18%</option><option value="0">Without GST</option></select></F>
            <F label="Start date"><input type="date" name="startDate" className="input" /></F>
          </div>
          <F label="Confirmed services"><div className="rounded-[10px] border border-[var(--line)] p-3 text-[12.5px]">{(lead.servicesArr ?? []).join(", ") || "—"}</div></F>
          {/* Sales assigns the work here at onboarding */}
          {(k.web || k.dm) && (
            <div className="grid gap-3 rounded-[10px] border border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_4%,white)] p-3 sm:grid-cols-2">
              {k.web && <F label="Assign to Developer (Website)"><select name="assignDev" className="select"><option value="">— Select later —</option>{developers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>}
              {k.dm && <F label="Assign to Marketing (Digital Marketing)"><select name="assignDm" className="select"><option value="">— Select later —</option>{dmPeople.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></F>}
            </div>
          )}
          <F label="Client requirements"><textarea name="requirements" defaultValue={lead.requirements} rows={2} className="textarea" /></F>
          <F label="Notes"><textarea name="notes" rows={2} className="textarea" /></F>
          <div className="flex items-center justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn btn-violet">Confirm onboarding</button></div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ lead, svc, close }: { lead: Lead; svc: string[]; close: () => void }) {
  const groups = serviceGroupsFor(lead.pipeline);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4"><div><h2 className="text-[16px] font-bold">Edit lead</h2><p className="text-[12px] text-[var(--muted)]">Update any detail — contact, services, value or requirements.</p></div><button onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button></div>
        <form action={updateLead} className="flex flex-col gap-3 overflow-y-auto p-6 scroll-thin"><input type="hidden" name="id" value={lead.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Lead / client name"><input name="name" defaultValue={lead.name} required className="input" /></F>
            <F label="Company"><input name="company" defaultValue={lead.company} className="input" /></F>
            <F label="Contact person"><input name="contactPerson" defaultValue={lead.contactPerson} className="input" /></F>
            <F label="Phone"><input name="phone" defaultValue={lead.phone} className="input" /></F>
            <F label="WhatsApp"><input name="whatsapp" defaultValue={lead.whatsapp} className="input" /></F>
            <F label="Email"><input name="email" defaultValue={lead.email} className="input" /></F>
            <F label="Source"><select name="source" defaultValue={lead.source || ""} className="select"><option value="">— Select —</option>{LEAD_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></F>
            <F label="Lead value (₹)"><input type="number" name="value" defaultValue={lead.value || ""} className="input" /></F>
          </div>
          <F label="Services">
            <div className="space-y-3 rounded-[10px] border border-[var(--line)] p-3">
              {Object.entries(groups).map(([grp, items]) => (
                <div key={grp}>
                  <div className="eyebrow mb-1.5">{grp}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((it) => (
                      <label key={it} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line-2)] px-2.5 py-1 text-[12px] has-[:checked]:border-[var(--violet)] has-[:checked]:bg-[color-mix(in_srgb,var(--violet)_10%,white)]">
                        <input type="checkbox" name="services" value={it} defaultChecked={svc.includes(it)} className="accent-[var(--violet)]" />{it}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </F>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Budget (₹)"><input type="number" name="budget" defaultValue={lead.budget || ""} className="input" /></F>
            <F label="Expected start date"><input type="date" name="expectedStart" defaultValue={lead.expectedStart} className="input" /></F>
            <F label="Decision maker"><input name="decisionMaker" defaultValue={lead.decisionMaker} className="input" /></F>
            <F label="Timeline"><input name="timeline" defaultValue={lead.timeline} className="input" /></F>
          </div>
          <F label="Requirements"><textarea name="requirements" defaultValue={lead.requirements} rows={2} className="textarea" /></F>
          <F label="Next action"><input name="nextAction" defaultValue={lead.nextAction} className="input" /></F>
          <F label="Notes"><textarea name="notes" defaultValue={lead.notes} rows={2} className="textarea" /></F>
          <div className="flex items-center justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn btn-violet">Save changes</button></div>
        </form>
      </div>
    </div>
  );
}

function LostModal({ lead, close }: { lead: Lead; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-[460px] overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4"><h2 className="text-[16px] font-bold">Mark lead as Lost</h2><button onClick={close} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button></div>
        <form action={markLost} className="flex flex-col gap-3 p-6"><input type="hidden" name="id" value={lead.id} />
          <F label="Lost reason"><select name="lostReason" required className="select"><option value="">— Select —</option>{LOST_REASONS.map((x) => <option key={x}>{x}</option>)}</select></F>
          <F label="Lost date"><input type="date" name="lostDate" className="input" /></F>
          <F label="Notes"><textarea name="lostNotes" rows={3} className="textarea" /></F>
          <p className="text-[11.5px] text-[var(--faint)]">Lost leads keep their full history — they are not deleted.</p>
          <div className="flex items-center justify-end gap-2"><button type="button" onClick={close} className="btn btn-ghost">Cancel</button><button type="submit" className="btn" style={{ background: "var(--rose)", color: "#fff" }}>Mark Lost</button></div>
        </form>
      </div>
    </div>
  );
}
