import { getClientDetail, getClientAds } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { inr, inrShort, CLIENT_STATUS, SERVICES, WORK_STATUS, CAMPAIGN_TYPES } from "@/lib/domain";
import { Avatar, Badge, Card, Eyebrow, Progress, IconChip } from "@/components/ui";
import { deleteClient, setClientStatus, addClientContact, deleteClientContact, setRenewalDate } from "@/app/actions";
import { Pencil, Plus, Trash2, TrendingUp, TrendingDown, Minus, Search, Megaphone, Users2, Phone, Mail, CalendarClock, X } from "lucide-react";

export const dynamic = "force-dynamic";

const METRIC_LABEL: Record<string, string> = {
  blogs: "Blogs", keywords: "Keywords", static: "Static posts", carousel: "Carousels",
  reels: "Reels", aiVideos: "AI videos", reelsEdit: "Reels edit",
};

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const data = await getClientDetail(id);
  if (!data) notFound();
  const { client: c, pct, agreed, cp, band, track, updates } = data;
  const ads = await getClientAds(id);
  const me = await getCurrentUser();
  const isSuper = me?.role === "SUPER_ADMIN" || me?.role === "SUB_ADMIN";
  const renewalDays = c.renewalDate ? Math.ceil((new Date(c.renewalDate + "T23:59:59").getTime() - Date.now()) / 86400000) : null;

  // latest ranking per keyword
  const rankMap = new Map<string, (typeof updates)[number]>();
  for (const u of updates) {
    if (u.workType === "ranking" && u.keyword && !rankMap.has(u.keyword)) rankMap.set(u.keyword, u);
  }
  const rankings = [...rankMap.values()];

  return (
    <div className="space-y-5">
      <a href="/clients" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← All clients</a>

      {/* header */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={c.name} size={58} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
              <Badge tone={band.tone}>{CLIENT_STATUS[c.status as keyof typeof CLIENT_STATUS] ?? c.status}</Badge>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {c.pocName} · {c.industry} · {c.code}{c.website && <> · <a className="text-[var(--violet)]" href={`https://${c.website}`} target="_blank">{c.website}</a></>}
            </p>
          </div>
          <div className="flex gap-2">
            {isSuper && <a href={`/clients/${c.id}/edit`} className="btn btn-ghost"><Pencil size={14} /> Edit</a>}
            <a href={`/updates?clientId=${c.id}`} className="btn btn-dark"><Plus size={15} /> Update work</a>
            {isSuper && (
              <form action={deleteClient}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn btn-ghost !text-[var(--rose)]"><Trash2 size={14} /></button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">This month&apos;s deliverables</h2>
            <span className="text-sm font-bold tnum">{cp.total}/{agreed} · {pct}%</span>
          </div>
          <div className="mt-3"><Progress pct={pct} tone={band.tone} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {track.length === 0 && <p className="text-sm text-[var(--muted)]">No measurable deliverables set for this client.</p>}
            {track.map((t) => {
              const p = t.agreed ? Math.round((t.done / t.agreed) * 100) : 0;
              return (
                <div key={t.metric} className="rounded-[var(--r-md)] border border-[var(--line)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{METRIC_LABEL[t.metric] ?? t.metric}</span>
                    <span className="text-sm font-bold tnum">{t.done}<span className="font-medium text-[var(--muted)]">/{t.agreed}</span></span>
                  </div>
                  <div className="mt-2"><Progress pct={p} /></div>
                  <div className="eyebrow mt-2">{t.pending} pending · {SERVICES[t.service as keyof typeof SERVICES]?.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* client record */}
        <Card>
          <h2 className="text-[15px] font-bold">Client record</h2>

          {/* status switcher */}
          <div className="mt-3">
            <Eyebrow>Status</Eyebrow>
            <div className="mt-1.5 flex gap-1.5">
              {Object.entries(CLIENT_STATUS).map(([k, v]) => (
                <form key={k} action={setClientStatus}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value={k} />
                  <button className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${c.status === k ? "border-transparent bg-[var(--ink)] text-white" : "border-[var(--line-2)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>{v}</button>
                </form>
              ))}
            </div>
          </div>

          <dl className="mt-4 space-y-3 border-t border-[var(--line)] pt-4 text-sm">
            {c.monthlyRetainer > 0 && <Row k="Monthly retainer" v={inr(c.monthlyRetainer)} />}
            <Row k="Industry" v={c.industry ?? "—"} />
            <Row k="Account manager" v={c.accountManager?.name ?? "—"} />
            <Row k="POC mobile" v={c.pocMobile ?? "—"} />
            <Row k="POC email" v={c.pocEmail ?? "—"} />
            <Row k="Onboarded" v={new Date(c.onboardDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
          </dl>

          {/* renewal tracker */}
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Contract renewal</Eyebrow>
              {renewalDays !== null && (
                <span className="badge tnum" style={{ background: `color-mix(in srgb, var(--${renewalDays < 0 ? "rose" : renewalDays <= 30 ? "amber" : "emerald"}) 12%, white)`, color: `var(--${renewalDays < 0 ? "rose" : renewalDays <= 30 ? "amber" : "emerald"})` }}>
                  {renewalDays < 0 ? `${Math.abs(renewalDays)}d overdue` : `in ${renewalDays}d`}
                </span>
              )}
            </div>
            <form action={setRenewalDate} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="clientId" value={c.id} />
              <CalendarClock size={15} className="text-[var(--muted)]" />
              <input type="date" name="renewalDate" defaultValue={c.renewalDate} className="input !h-9 flex-1 !text-[13px]" />
              <button className="btn btn-ghost btn-sm">Save</button>
            </form>
          </div>

          <div className="mt-4">
            <Eyebrow>Services</Eyebrow>
            <div className="mt-2 space-y-1.5">
              {c.services.map((sv) => (
                <div key={sv.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{SERVICES[sv.service as keyof typeof SERVICES]?.label ?? sv.service}</span>
                  {sv.detail && <span className="text-right text-xs text-[var(--muted)]">{sv.detail}</span>}
                </div>
              ))}
              {c.services.length === 0 && <span className="text-sm text-[var(--muted)]">No services yet.</span>}
            </div>
          </div>

          <div className="mt-4">
            <Eyebrow>Team</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.assignments.map((a) => (
                <span key={a.id} className="tag"><Avatar name={a.user.name} size={18} /> {a.user.name}</span>
              ))}
              {c.assignments.length === 0 && <span className="text-sm text-[var(--muted)]">No team assigned.</span>}
            </div>
          </div>

          {c.notes && (
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <Eyebrow>Notes</Eyebrow>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--ink-2)]">{c.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Client contacts */}
      <Card>
        <div className="flex items-center gap-2">
          <IconChip icon={Users2} tone="violet" size={30} />
          <h2 className="text-[15px] font-bold">Contacts</h2>
          <span className="tag tnum">{c.contacts.length}</span>
        </div>
        {c.contacts.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.contacts.map((ct) => (
              <div key={ct.id} className="group relative rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
                {isSuper && (
                  <form action={deleteClientContact} className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                    <input type="hidden" name="id" value={ct.id} />
                    <input type="hidden" name="clientId" value={c.id} />
                    <button className="grid h-6 w-6 place-items-center rounded text-[var(--faint)] hover:text-[var(--rose)]"><X size={13} /></button>
                  </form>
                )}
                <div className="flex items-center gap-2.5">
                  <Avatar name={ct.name} size={34} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold">{ct.name}</div>
                    {ct.role && <div className="truncate text-[11.5px] text-[var(--muted)]">{ct.role}</div>}
                  </div>
                </div>
                <div className="mt-2.5 space-y-1 text-[12px]">
                  {ct.phone && <a href={`tel:${ct.phone}`} className="flex items-center gap-1.5 text-[var(--ink-2)] hover:text-[var(--violet)]"><Phone size={12} /> {ct.phone}</a>}
                  {ct.email && <a href={`mailto:${ct.email}`} className="flex items-center gap-1.5 truncate text-[var(--ink-2)] hover:text-[var(--violet)]"><Mail size={12} /> {ct.email}</a>}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* add contact */}
        <form action={addClientContact} className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <input type="hidden" name="clientId" value={c.id} />
          <label className="block"><span className="eyebrow">Name *</span><input name="name" required className="input mt-1 !h-9 !text-[13px]" placeholder="Full name" /></label>
          <label className="block"><span className="eyebrow">Role</span><input name="role" className="input mt-1 !h-9 !text-[13px]" placeholder="e.g. Marketing Head" /></label>
          <label className="block"><span className="eyebrow">Phone</span><input name="phone" className="input mt-1 !h-9 !text-[13px]" placeholder="+91 …" /></label>
          <label className="block"><span className="eyebrow">Email</span><input name="email" type="email" className="input mt-1 !h-9 !text-[13px]" placeholder="name@…" /></label>
          <button className="btn btn-violet btn-sm"><Plus size={14} /> Add contact</button>
        </form>
      </Card>

      {/* Meta Ads performance (this month) */}
      {ads.hasData && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconChip icon={Megaphone} tone="violet" size={30} />
              <h2 className="text-[15px] font-bold">Meta Ads performance</h2>
            </div>
            <span className="eyebrow">{ads.monthLabel} · {ads.totals.days} day{ads.totals.days !== 1 ? "s" : ""} logged</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdStat label="Ad spend" value={inrShort(ads.totals.spend)} tone="violet" />
            <AdStat label="Leads" value={ads.totals.leads.toLocaleString("en-IN")} tone="sky" sub={`${ads.totals.conversions} conversions`} />
            <AdStat label="Avg CPL" value={ads.totals.cpl ? inr(ads.totals.cpl) : "—"} tone="emerald" sub="cost per lead" />
            <AdStat label={ads.totals.saleValue ? "ROAS" : "Reach"} value={ads.totals.saleValue ? `${ads.totals.roas}x` : ads.totals.reach.toLocaleString("en-IN")} tone="amber" sub={ads.totals.saleValue ? `${inrShort(ads.totals.saleValue)} sales` : "awareness"} />
          </div>
          {/* per-campaign breakdown */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(ads.byType).map(([type, b]) => {
              const cfg = CAMPAIGN_TYPES[type as keyof typeof CAMPAIGN_TYPES];
              return (
                <span key={type} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-semibold">
                  {cfg?.label ?? type}: <span className="tnum text-[var(--muted)]">{b.results} {cfg?.result ?? "results"} · {inrShort(b.spend)}</span>
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* SEO rankings */}
      {rankings.length > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            <IconChip icon={Search} tone="sky" size={30} />
            <h2 className="text-[15px] font-bold">SEO keyword rankings</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rankings.map((r) => {
              const delta = (r.prevPosition ?? 0) - (r.currPosition ?? 0); // positive = improved (lower number)
              const tone = delta > 0 ? "emerald" : delta < 0 ? "rose" : "slate";
              const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{r.keyword}</div>
                    <div className="eyebrow mt-0.5 tnum">#{r.prevPosition} → #{r.currPosition}</div>
                  </div>
                  <span className={`badge badge-${tone} tnum`}><Icon size={12} /> {delta > 0 ? `+${delta}` : delta}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* activity history */}
      <Card pad={false}>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[15px] font-bold">Activity history</h2>
          <span className="tag tnum">{updates.length} updates</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead>
              <tr className="border-y border-[var(--line)]">
                <th className="th">Date</th><th className="th">Work type</th><th className="th">Qty</th>
                <th className="th">Status</th><th className="th">By</th><th className="th">Detail</th>
              </tr>
            </thead>
            <tbody>
              {updates.slice(0, 40).map((u) => (
                <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="td whitespace-nowrap tnum">{new Date(u.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td className="td font-medium">{u.workType}</td>
                  <td className="td tnum">{u.quantity}</td>
                  <td className="td">
                    <span className={`badge ${["COMPLETED", "APPROVED"].includes(u.status) ? "badge-emerald" : "badge-amber"}`}>
                      {WORK_STATUS[u.status as keyof typeof WORK_STATUS] ?? u.status}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap">{u.user.name}</td>
                  <td className="td text-[var(--muted)]">{u.keyword ? `${u.keyword} · ${u.prevPosition}→${u.currPosition}` : (u.title ?? u.detail ?? "—")}</td>
                </tr>
              ))}
              {updates.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-[var(--muted)]">No activity logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--muted)]">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}

const ADTONE: Record<string, string> = { violet: "var(--violet)", sky: "var(--sky)", emerald: "var(--emerald)", amber: "var(--amber)" };
function AdStat({ label, value, tone, sub }: { label: string; value: string; tone: string; sub?: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 text-[22px] font-extrabold leading-none tracking-tight tnum" style={{ color: ADTONE[tone] }}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-[var(--muted)] tnum">{sub}</div>}
    </div>
  );
}
