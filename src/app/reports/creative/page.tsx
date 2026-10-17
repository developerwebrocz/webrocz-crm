import Link from "next/link";
import { getCreativeReport } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeReport from "@/components/CreativeReport";
import DesignSheet from "@/components/DesignSheet";
import { getDesignSheet } from "@/lib/design-sheet-queries";
import { ownClientsOf } from "@/lib/am-scope";

export const dynamic = "force-dynamic";

export default async function CreativeReportPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Designer/editor work oversight — Super Admin + the managers who assign creative work
  // (AM Head / Account Manager / DM Head / DM Exec) so they can track output.
  const ALLOWED = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "ACCOUNT_MANAGER", "DM_HEAD", "DM_EXEC"];
  if (!ALLOWED.includes(user.role)) redirect("/");
  const d = await getCreativeReport(ownClientsOf(user)); // an account manager: their own clients' work only

  // Super Admin: everything the designers and the video editors reported (Update Work and the
  // daily count) — by person, client, kind of work and how many — above the assigned tasks
  let top: React.ReactNode = null;
  if (user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN") {
    const sp = await searchParams;
    const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
    const video = q("team") === "video";
    const sheet = await getDesignSheet({ period: q("period") || "week", client: q("client"), designer: q("designer") }, video ? "VIDEO" : "DESIGN");
    const tab = (on: boolean) => `rounded-[9px] px-4 py-2 text-[13.5px] font-medium transition ${on ? "bg-[var(--violet)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`;
    top = (
      <div key="work-report" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">Work report</h2>
          <div className="inline-flex gap-1 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-1">
            <Link href="/reports/creative?team=design" scroll={false} className={tab(!video)}>Designers</Link>
            <Link href="/reports/creative?team=video" scroll={false} className={tab(video)}>Video editors</Link>
          </div>
        </div>
        <DesignSheet d={sheet} path="/reports/creative" everyone={video ? "All editors" : "All designers"} person={video ? "Editor" : "Designer"} />
      </div>
    );
  }
  return <CreativeReport rows={d.rows} clients={d.clients} types={d.types} days={d.days} members={d.members} assigners={d.assigners} clientOptions={d.clientOptions} today={d.today} currentUserId={user.id} top={top} />;
}
