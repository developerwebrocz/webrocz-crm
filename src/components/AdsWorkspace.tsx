import { getAdsEntry, getSmoEntry } from "@/lib/queries";
import { saveClientCampaigns, saveClientPosts, copyAdsYesterday, copySmoYesterday } from "@/app/actions";
import { CopyPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/ui";
import AdsDayHeader from "@/components/AdsDayHeader";
import AdsBoard from "@/components/AdsBoard";
import SmoBoard from "@/components/SmoBoard";
import { now } from "@/lib/period";

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function todayKey() { return keyOf(now()); }
function yesterdayKey() { const d = now(); d.setDate(d.getDate() - 1); return keyOf(d); }

type AdsTotals = { spend: number; leads: number; conversions: number; saleValue: number; reach: number; cpl: number; roas: number; bestClient: { name: string; cpl: number } | null };
type SmoTotals = { posts: number; posted: number; scheduled: number; activeClients: number; platforms: number };

export default async function AdsWorkspace({
  mode, searchParams,
}: {
  mode: "meta" | "smo";
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const smo = mode === "smo";
  // Meta Ads is entered next morning for the previous day → default to yesterday. SM Posts default to today.
  const date = typeof sp.date === "string" ? sp.date : smo ? todayKey() : yesterdayKey();

  // Account Managers only ever see their own clients — the AM selector is locked to them.
  const isAM = user.role === "ACCOUNT_MANAGER" || user.role === "DM_EXEC";
  const amId = isAM ? user.id : typeof sp.am === "string" ? sp.am : undefined;

  const basePath = smo ? "/smo" : "/ads";
  const data = smo ? await getSmoEntry(date, amId) : await getAdsEntry(date, amId);
  const { ams, activeAm } = data;
  const amName = isAM ? user.name : ams.find((a) => a.id === activeAm)?.name ?? "—";
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  const rel = date === todayKey() ? "Today" : date === yesterdayKey() ? "Yesterday" : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Daily update mode · per-client</Eyebrow>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-2 text-[26px] font-extrabold tracking-tight">
            {smo ? "SM Posts" : "Meta Ads"} — {dateLabel}
            {rel && <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--ink-2)]">{rel}</span>}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {smo
              ? "Log each client's social posts per platform — link, type & status."
              : "Enter yesterday's Meta Ads results each morning — CPL, CPM & ROAS calculate automatically."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={smo ? copySmoYesterday : copyAdsYesterday}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="amId" value={activeAm ?? ""} />
            <button className="btn btn-ghost !py-2" title="Pre-load yesterday's setup for every client"><CopyPlus size={15} /> Copy yesterday</button>
          </form>
          <AdsDayHeader
            ams={ams.map((a) => ({ id: a.id, name: a.name }))}
            activeAm={activeAm ?? ""} date={date} basePath={basePath}
            locked={isAM} lockedName={amName}
          />
        </div>
      </div>

      {smo ? (
        <SmoBoard
          rows={data.rows as never} date={date} action={saveClientPosts}
          counts={data.counts} totalPosts={(data as { totalPosts: number }).totalPosts} totals={(data as { totals: SmoTotals }).totals} amName={amName} dateLabel={dateLabel}
        />
      ) : (
        <AdsBoard
          rows={data.rows as never} date={date} action={saveClientCampaigns}
          counts={data.counts} totalEntries={(data as { totalEntries: number }).totalEntries} totals={(data as { totals: AdsTotals }).totals} amName={amName} dateLabel={dateLabel}
        />
      )}
    </div>
  );
}
