import { getGoogleAdsEntry } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { saveGoogleAdsDay } from "@/app/actions";
import { redirect } from "next/navigation";
import { GADS_TYPES, inrShort } from "@/lib/domain";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const ROWS = 8;

export default async function GoogleAdsEntryPage({ searchParams }: PageProps<"/google-ads/entry">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const period = typeof sp.period === "string" ? sp.period : "YESTERDAY";
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const d = await getGoogleAdsEntry(user.id, user.role, clientId, period);

  const rows = [...d.rows];
  while (rows.length < ROWS) rows.push({ name: "", type: "SEARCH", spent: 0, leads: 0, conv: 0, status: "ACTIVE" });

  const selectedClient = d.clients.find((c) => c.id === d.selected);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-[960px] px-5 py-8">
        <a href={`/google-ads?period=${period}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back to Google Ads</a>
        <h1 className="text-[24px] font-extrabold tracking-tight">Add / edit daily data</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Enter each campaign&apos;s numbers for {d.dateLabel}. CPL and Conv% are calculated automatically.</p>

        {!d.selected ? (
          <div className="card card-pad mt-6 text-sm text-[var(--muted)]">You have no Google Ads clients assigned.</div>
        ) : (
          <>
            {/* client picker */}
            <div className="mt-5 flex flex-wrap gap-2">
              {d.clients.map((c) => (
                <a key={c.id} href={`/google-ads/entry?client=${c.id}&period=${period}`}
                  className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${c.id === d.selected ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_8%,white)] text-[var(--violet)]" : "border-[var(--line-2)] hover:border-[var(--ink)]"}`}>
                  {c.name} <span className="text-[var(--faint)]">· {inrShort(c.googleBudget)}/mo</span>
                </a>
              ))}
            </div>

            <form action={saveGoogleAdsDay} className="card !p-0 mt-5 overflow-hidden">
              <input type="hidden" name="clientId" value={d.selected} />
              <input type="hidden" name="date" value={d.date} />
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name="rows" value={ROWS} />

              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                <div>
                  <div className="text-[15px] font-bold">{selectedClient?.name}</div>
                  <div className="text-[12px] text-[var(--muted)]">{d.dateLabel} · leave a row&apos;s campaign name blank to skip it</div>
                </div>
              </div>

              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[760px] text-left">
                  <thead><tr className="border-b border-[var(--line)]">{["Campaign name", "Type", "Spent (₹)", "Leads", "Conv", "Status"].map((h) => <th key={h} className="th px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-4 py-2"><input name={`name_${i}`} defaultValue={r.name} placeholder="e.g. Search - Brand" className="w-full min-w-[180px] rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]" /></td>
                        <td className="px-4 py-2">
                          <select name={`type_${i}`} defaultValue={r.type} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2 py-2 text-[13px] outline-none focus:border-[var(--violet)]">
                            {Object.entries(GADS_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input name={`spent_${i}`} type="number" min={0} defaultValue={r.spent || ""} className="w-24 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                        <td className="px-4 py-2"><input name={`leads_${i}`} type="number" min={0} defaultValue={r.leads || ""} className="w-20 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                        <td className="px-4 py-2"><input name={`conv_${i}`} type="number" min={0} defaultValue={r.conv || ""} className="w-20 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-2 text-[13px] tnum outline-none focus:border-[var(--violet)]" /></td>
                        <td className="px-4 py-2">
                          <select name={`status_${i}`} defaultValue={r.status} className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-2 py-2 text-[13px] outline-none focus:border-[var(--violet)]">
                            <option value="ACTIVE">Active</option>
                            <option value="PAUSED">Paused</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
                <a href={`/google-ads?period=${period}`} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</a>
                <button type="submit" className="btn btn-violet">Save daily data</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
