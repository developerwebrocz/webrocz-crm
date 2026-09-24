"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { SERVICES, SERVICE_KEYS, INDUSTRIES, CLIENT_STATUS, type ServiceKey } from "@/lib/domain";
import { Eyebrow } from "./ui";

type U = { id: string; name: string; role: string };

export type ClientInitial = {
  id?: string;
  name?: string; website?: string; industry?: string; monthlyRetainer?: number;
  pocName?: string; pocMobile?: string; pocEmail?: string;
  status?: string; onboardDate?: string; notes?: string;
  accountManagerId?: string; amHeadId?: string; seoHeadId?: string; seoMemberId?: string; designerId?: string; editorId?: string; devId?: string;
  services?: string[]; detailOther?: string; deliverables?: Record<string, number>;
};

function Section({ n, title, sub, children }: { n: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-extrabold text-[var(--violet)]">{n}</span>
        <div>
          <h2 className="font-bold">{title}</h2>
          {sub && <p className="text-sm text-[var(--muted)]">{sub}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}{required && <span className="text-[var(--rose)]"> *</span>}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

function Footer({ selectedCount, editing }: { selectedCount: number; editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <div className="text-sm text-[var(--muted)]">
        <span className="font-semibold text-[var(--ink)]">{selectedCount}</span> service{selectedCount === 1 ? "" : "s"} selected
      </div>
      <div className="ml-auto flex gap-2">
        <button type="reset" className="btn btn-ghost">Reset</button>
        <button type="submit" disabled={pending} className="btn btn-violet disabled:opacity-60">
          {pending ? "Saving…" : editing ? "Save changes" : "Save client"}
        </button>
      </div>
    </div>
  );
}

export default function NewClientForm({
  users, action, today, initial = {},
}: {
  users: U[]; action: (fd: FormData) => void; today: string; initial?: ClientInitial;
}) {
  const editing = !!initial.id;
  const [selected, setSelected] = useState<ServiceKey[]>((initial.services as ServiceKey[]) ?? []);
  const has = (k: ServiceKey) => selected.includes(k);
  const byRoles = (roles: string[]) => users.filter((u) => roles.includes(u.role));
  const toggle = (k: ServiceKey) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const measurable = selected.filter((s) => SERVICES[s].metrics.length > 0);
  const del = (svc: string, key: string) => initial.deliverables?.[`${svc}_${key}`];

  return (
    <form action={action} className="space-y-5">
      {editing && <input type="hidden" name="id" value={initial.id} />}

      <Section n="01" title="Client / company info">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client / company name" required><input name="name" required className="input" placeholder="Sri Lakshmi Jewels" defaultValue={initial.name} /></Field>
          <Field label="Website"><input name="website" className="input" placeholder="client.com" defaultValue={initial.website} /></Field>
          <Field label="Industry / category">
            <select name="industry" className="select" defaultValue={initial.industry ?? ""}>
              <option value="">Select category</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section n="02" title="Contact details (POC)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="POC name" required><input name="pocName" className="input" placeholder="Owner / Director" defaultValue={initial.pocName} /></Field>
          <Field label="Mobile number" required><input name="pocMobile" className="input" placeholder="98XXXXXXXX" defaultValue={initial.pocMobile} /></Field>
          <Field label="Email ID" required><input name="pocEmail" type="email" className="input" placeholder="name@company.com" defaultValue={initial.pocEmail} /></Field>
        </div>
      </Section>

      <Section n="03" title="Services taken" sub="Deliverable fields appear for the services that need them.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {SERVICE_KEYS.map((k) => {
            const on = has(k);
            return (
              <button type="button" key={k} onClick={() => toggle(k)}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${on ? "border-transparent bg-[var(--ink)] text-white" : "border-[var(--line-2)] bg-[var(--surface)] hover:border-[var(--ink)]"}`}>
                <span className={`grid h-5 w-5 flex-none place-items-center rounded-md text-xs ${on ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)]"}`}>{on ? "✓" : ""}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight">{SERVICES[k].label}</span>
                  <span className={`block text-[10px] uppercase tracking-wider ${on ? "text-white/50" : "text-[var(--muted)]"}`}>{SERVICES[k].sub}</span>
                </span>
                {on && <input type="hidden" name={`svc_${k}`} value="on" />}
              </button>
            );
          })}
        </div>

        {measurable.length > 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] p-4">
            <Eyebrow>Agreed monthly deliverables</Eyebrow>
            <p className="mb-3 text-xs text-[var(--muted)]">Used for agreed vs completed vs pending across every dashboard.</p>
            <div className="space-y-4">
              {measurable.map((svc) => (
                <div key={svc}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span>{SERVICES[svc].mark}</span> {SERVICES[svc].label}</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SERVICES[svc].metrics.map((m) => (
                      <Field key={m.key} label={m.label}>
                        {m.key === "websiteType" || m.key === "brandingScope"
                          ? <input name={`del_${svc}_${m.key}`} className="input" placeholder="Describe" defaultValue={del(svc, m.key) ?? ""} />
                          : <input name={`del_${svc}_${m.key}`} type="number" min={0} className="input" placeholder="0" defaultValue={del(svc, m.key) ?? ""} />}
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {has("OTHER") && <div className="mt-4"><Field label="Specify service" required><input name="detail_OTHER" className="input" placeholder="e.g. Influencer outreach" defaultValue={initial.detailOther} /></Field></div>}
      </Section>

      <Section n="04" title="Team & assignment" sub="Department leads become mandatory once their service is selected.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Account manager" required>
            <select name="accountManagerId" className="select" required defaultValue={initial.accountManagerId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["ACCOUNT_MANAGER", "DM_EXEC"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Account management head">
            <select name="amHeadId" className="select" defaultValue={initial.amHeadId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["AM_HEAD"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="SEO head" required={has("SEO")} hint={has("SEO") ? "Required if SEO is selected" : undefined}>
            <select name="seoHeadId" className="select" required={has("SEO")} defaultValue={initial.seoHeadId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["SEO_HEAD"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="SEO team member" required={has("SEO")} hint={has("SEO") ? "Required if SEO is selected" : undefined}>
            <select name="seoMemberId" className="select" required={has("SEO")} defaultValue={initial.seoMemberId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["SEO"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Designer" required={has("SMO")} hint={has("SMO") ? "Required if SMO is selected" : undefined}>
            <select name="designerId" className="select" required={has("SMO")} defaultValue={initial.designerId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["DESIGNER"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Video editor" required={has("VIDEO")} hint={has("VIDEO") ? "Required if Video is selected" : undefined}>
            <select name="editorId" className="select" required={has("VIDEO")} defaultValue={initial.editorId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["EDITOR"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Developer" hint="For website / landing-page work">
            <select name="devId" className="select" defaultValue={initial.devId ?? ""}>
              <option value="">Unassigned</option>
              {byRoles(["WEB_DEV", "DEV_HEAD"]).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Onboarding date" required><input name="onboardDate" type="date" className="input" defaultValue={initial.onboardDate ?? today} /></Field>
        </div>
      </Section>

      <Section n="05" title="Status & notes">
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(CLIENT_STATUS).map(([k, v], i) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line-2)] p-3 has-[:checked]:border-[var(--violet)] has-[:checked]:bg-[color-mix(in_srgb,var(--violet)_7%,white)]">
              <input type="radio" name="status" value={k} defaultChecked={initial.status ? initial.status === k : i === 0} className="accent-[var(--violet)]" />
              <span className="text-sm font-semibold">{v}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Internal notes">
            <textarea name="notes" rows={3} className="textarea" placeholder="Context, expectations, next steps…" defaultValue={initial.notes} />
          </Field>
        </div>
      </Section>

      <Footer selectedCount={selected.length} editing={editing} />
    </form>
  );
}
