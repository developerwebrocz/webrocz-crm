import Link from "next/link";
import { getAdminSalesFinance } from "@/lib/queries";
import { inr, inrShort, SALES_STAGES, SALES_STAGE_KEYS, SALES_STAGE_TONE } from "@/lib/domain";
import { Card, Eyebrow, IconChip } from "@/components/ui";
import { Target, UserCheck, BellRing, Wallet, IndianRupee, Clock, ShieldCheck, Layers } from "lucide-react";

// Super-Admin-only summary of the whole Sales pipeline + Finance — read at a glance.
export default async function SalesFinanceOverview() {
  const d = await getAdminSalesFinance();
  const cat = d.category;
  const catTotal = Math.max(1, cat.web.value + cat.dm.value);
  const webPct = Math.round((cat.web.value / catTotal) * 100);
  const collectPct = d.finance.billed ? Math.round((d.finance.received / d.finance.billed) * 100) : 0;
  const monthName = (m: string) => { const [y, mm] = m.split("-"); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">Sales &amp; Finance</h2>
        <div className="flex gap-3">
          <Link href="/sales" className="eyebrow hover:text-[var(--violet)]">Sales →</Link>
          <Link href="/invoices" className="eyebrow hover:text-[var(--violet)]">Invoices →</Link>
        </div>
      </div>

      {/* Sales KPIs */}
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={Target} tone="sky" size={30} /><Eyebrow>Pipeline value</Eyebrow></div>
          <div className="mt-2 text-[30px] font-extrabold leading-none tracking-tight tnum text-[var(--sky)]">{inrShort(d.activeValue)}</div>
          <div className="mt-1.5 text-[12px] text-[var(--muted)] tnum">{d.totalLeads} leads in pipeline (open)</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={UserCheck} tone="emerald" size={30} /><Eyebrow>Onboarded</Eyebrow></div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[30px] font-extrabold leading-none tracking-tight tnum text-[var(--emerald)]">{d.onboardedThisMonth}</span>
            <span className="mb-1 text-[12px] text-[var(--muted)]">this month</span>
          </div>
          <div className="mt-1.5 text-[12px] text-[var(--muted)] tnum">{inrShort(d.wonValue)} total won value</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={BellRing} tone="amber" size={30} /><Eyebrow>Reminders due</Eyebrow></div>
          <div className="mt-2 text-[30px] font-extrabold leading-none tracking-tight tnum" style={{ color: d.remindersDue ? "var(--rose)" : "var(--emerald)" }}>{d.remindersDue}</div>
          <Link href="/sales?stage=REMINDER" className="mt-1.5 inline-block text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--violet)]">need follow-up today →</Link>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={Layers} tone="violet" size={30} /><Eyebrow>By category</Eyebrow></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)] flex">
            <div className="h-full" style={{ width: `${webPct}%`, background: "var(--sky)" }} />
            <div className="h-full flex-1" style={{ background: "var(--violet)" }} />
          </div>
          <div className="mt-2 flex justify-between text-[11.5px]">
            <span className="font-semibold" style={{ color: "var(--sky)" }}>Website {cat.web.count} · {inrShort(cat.web.value)}</span>
            <span className="font-semibold" style={{ color: "var(--violet)" }}>DM {cat.dm.count} · {inrShort(cat.dm.value)}</span>
          </div>
        </Card>
      </div>

      {/* Pipeline funnel — one chip per stage, click to open that stage */}
      <Card>
        <Eyebrow>Sales pipeline — stage by stage</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {SALES_STAGE_KEYS.map((k) => (
            <Link key={k} href={`/sales?stage=${k}`} className="rounded-xl border border-[var(--line)] p-2.5 transition hover:-translate-y-0.5 hover:shadow-sm" style={{ background: `color-mix(in srgb, ${SALES_STAGE_TONE[k]} 7%, white)` }}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SALES_STAGE_TONE[k] }} />
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)] truncate">{SALES_STAGES[k]}</span>
              </div>
              <div className="mt-1 text-[24px] font-extrabold leading-none tnum" style={{ color: SALES_STAGE_TONE[k] }}>{d.stageCounts[k] ?? 0}</div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Finance KPIs */}
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={Wallet} tone="violet" size={30} /><Eyebrow>Total billed</Eyebrow></div>
          <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{inrShort(d.finance.billed)}</div>
          <div className="mt-1.5 text-[12px] text-[var(--muted)] tnum">{d.finance.invoices} invoices</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={IndianRupee} tone="emerald" size={30} /><Eyebrow>Received</Eyebrow></div>
          <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum text-[var(--emerald)]">{inrShort(d.finance.received)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--emerald)]" style={{ width: `${collectPct}%` }} /></div>
          <div className="mt-1 text-[11px] text-[var(--muted)] tnum">{collectPct}% collected</div>
        </Card>
        <Card className="!border-transparent" style={{ background: "color-mix(in srgb, var(--amber) 8%, white)" }}>
          <div className="flex items-center gap-2"><IconChip icon={Clock} tone="amber" size={30} /><Eyebrow>Pending amount</Eyebrow></div>
          <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum text-[var(--amber)]">{inrShort(d.finance.pending)}</div>
          <div className="mt-1.5 text-[12px] font-semibold text-[var(--rose)] tnum">{d.finance.overdue} overdue invoice{d.finance.overdue === 1 ? "" : "s"}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><IconChip icon={ShieldCheck} tone="rose" size={30} /><Eyebrow>Needs approval</Eyebrow></div>
          <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum" style={{ color: d.finance.pendingApproval ? "var(--rose)" : "var(--emerald)" }}>{d.finance.pendingApproval}</div>
          <Link href="/invoices" className="mt-1.5 inline-block text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--violet)]">invoices waiting for you →</Link>
        </Card>
      </div>

      {/* Monthly Website vs Digital Marketing */}
      {d.monthly.length > 0 && (
        <Card>
          <Eyebrow>Monthly billing — Website vs Digital Marketing</Eyebrow>
          <div className="mt-3 overflow-x-auto scroll-thin">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Website</th>
                  <th className="pb-2 text-right">Digital Mktg</th>
                  <th className="pb-2 text-right">Billed</th>
                  <th className="pb-2 text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {d.monthly.map((m) => (
                  <tr key={m.month} className="border-t border-[var(--line)]">
                    <td className="py-2 font-semibold">{monthName(m.month)}</td>
                    <td className="py-2 text-right tnum" style={{ color: "var(--sky)" }}>{inr(m.web)}</td>
                    <td className="py-2 text-right tnum" style={{ color: "var(--violet)" }}>{inr(m.dm)}</td>
                    <td className="py-2 text-right font-semibold tnum">{inr(m.billed)}</td>
                    <td className="py-2 text-right tnum text-[var(--emerald)]">{inr(m.received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
