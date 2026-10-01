import { getGoogleAdsEntry } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { saveGoogleAdsDay } from "@/app/actions";
import { redirect } from "next/navigation";
import AdsDayEntry from "@/components/AdsDayEntry";
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

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-[960px] px-5 py-8">
        <a href={`/google-ads?period=${period}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back to Google Ads</a>
        <h1 className="text-[24px] font-extrabold tracking-tight">Add Daily Data — {d.dateLabel}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Two quick steps: pick the client &amp; date, then fill the campaign checklist. CPL and Conv% are calculated automatically.</p>

        {!d.selected ? (
          <div className="card card-pad mt-6 text-sm text-[var(--muted)]">You have no Google Ads clients assigned.</div>
        ) : (
          <AdsDayEntry
            clients={d.clients} selected={d.selected} date={d.date} dateLabel={d.dateLabel}
            period={period} rows={rows} rowCount={ROWS} action={saveGoogleAdsDay}
          />
        )}
      </div>
    </div>
  );
}
