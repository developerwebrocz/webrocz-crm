import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getVideoTeamNames } from "@/lib/video-job-queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import EditCountBoard from "@/components/EditCountBoard";
import DesignSheet from "@/components/DesignSheet";
import { getDesignSheet } from "@/lib/design-sheet-queries";

export const dynamic = "force-dynamic";

// Video team "Editing Count": each editor's videos per day. Editors see their own; the team
// lead and admins see everyone, assign video work and can load the old Google Sheet.
export default async function VideoTeamPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenEditCount(user)) redirect("/");
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : "";
  const d = await getEditCountBoard(user, month);
  // every editor names the client of each video they log, so everyone gets the list
  const clients = (await getClientOptions()).map((c) => ({ id: c.id, name: c.name }));
  // the agency's own brands and the names the video team added, for "Assign work"
  const taken = new Set(clients.map((c) => c.name.trim().toLowerCase()));
  const names = (await getVideoTeamNames()).filter((n) => !taken.has(n.toLowerCase()));
  const board = <EditCountBoard d={d} me={{ id: user.id, name: user.name, isEditor: user.role === "EDITOR", isAdmin: isVideoAdmin(user) }} clients={clients} names={names} saved={saved} />;
  // an editor keeps their own page (enter the day, see their days)
  if (!d.seeAll) return board;
  // Super Admin / video lead: the team's work as one simple sheet first; entering or
  // correcting a day, the month table and assigning work are folded underneath
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const sheet = await getDesignSheet({ period: q("period"), client: q("client"), designer: q("designer") }, "VIDEO");
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Video team</div>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Video work</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">What each editor did — for which client, how many, and who assigned it</p>
      </div>
      <DesignSheet d={sheet} path="/video-team" everyone="All editors" person="Editor" />
      <details className="card !p-0 overflow-hidden" open={!!saved || !!month}>
        <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-bold text-[var(--violet)]">Enter or correct a day · month table · assign work</summary>
        <div className="border-t border-[var(--line)] p-5">{board}</div>
      </details>
    </div>
  );
}
