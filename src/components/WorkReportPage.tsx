import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isVideoAdmin } from "@/lib/edit-count-queries";
import { getDesignSheet } from "@/lib/design-sheet-queries";
import DesignSheet from "@/components/DesignSheet";

// Super Admin: the work report of one team (Designer → Work Report / Video Editor → Work Report):
// everything the designers / editors reported — by person, client, kind of work and how many.
export default async function WorkReportPage({ kind, searchParams }: { kind: "DESIGN" | "VIDEO"; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isVideoAdmin(user)) redirect(kind === "VIDEO" ? "/video-team" : "/design-team");
  const sp = await searchParams;
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const video = kind === "VIDEO";
  const sheet = await getDesignSheet({ period: q("period") || "week", client: q("client"), designer: q("designer") }, kind);
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12.5px] font-medium text-[var(--muted)]">{video ? "Video team" : "Design team"}</div>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--ink)]">{video ? "Video editors — work report" : "Designers — work report"}</h1>
        <p className="mt-1 text-[14px] text-[var(--muted)]">Everything each {video ? "editor" : "designer"} reported — client, kind of work, how many and status. Click a person to see only their work.</p>
      </div>
      <DesignSheet d={sheet} path={video ? "/video-report" : "/design-report"} everyone={video ? "All editors" : "All designers"} person={video ? "Editor" : "Designer"} />
    </div>
  );
}
