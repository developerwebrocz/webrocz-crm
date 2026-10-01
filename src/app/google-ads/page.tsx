import { getGoogleAdsBoard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import GoogleAdsConsole from "@/components/GoogleAdsConsole";

export const dynamic = "force-dynamic";

export default async function GoogleAdsPage({ searchParams }: PageProps<"/google-ads">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const period = typeof sp.period === "string" ? sp.period : "YESTERDAY";
  const am = typeof sp.am === "string" ? sp.am : null;
  const d = await getGoogleAdsBoard(user.id, user.role, period, am);

  return (
    <GoogleAdsConsole
      rows={d.rows} kpis={d.kpis} counts={d.counts} budgetClient={d.budgetClient}
      period={d.period} periodDate={d.periodDate}
      userName={user.name} userRole={user.role}
      isHead={d.isHead} ams={d.ams} viewAs={d.viewAs}
    />
  );
}
