import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getVideoTeamNames } from "@/lib/video-job-queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import EditCountBoard from "@/components/EditCountBoard";
import DesignSheet from "@/components/DesignSheet";
import DayEntryCard from "@/components/DayEntryCard";
import { workTypesFor } from "@/lib/design-work";
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
  // a video editor: their own page — enter the day client by client, and their work as a sheet
  if (!d.seeAll) {
    const q0 = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
    const mineSheet = await getDesignSheet({ period: q0("period") || "week", client: q0("client"), designer: user.id }, "VIDEO");
    const myDays: Record<string, { count: number; note: string; items: { client: string; type: string; count: number }[] }> = {};
    for (const [k, c] of Object.entries(d.cells)) { const [uid, day] = k.split("|"); if (uid === user.id) myDays[day] = { count: c.count, note: c.note, items: c.items }; }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">My videos</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">Enter what you edited each day — client by client</p>
        </div>
        <DayEntryCard team="VIDEO" today={d.today} firstDay={`${d.month}-01`} days={myDays} clientNames={[...names, ...clients.map((c) => c.name)]} types={workTypesFor("VIDEO")} noun="video" saved={saved === "1"} />
        <DesignSheet d={mineSheet} path="/video-team" mine title="My videos" />
      </div>
    );
  }
  // Super Admin / video lead: the team's work as one simple sheet first; entering or
  // correcting a day, the month table and assigning work are folded underneath
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const sheet = await getDesignSheet({ period: q("period"), client: q("client"), designer: q("designer") }, "VIDEO");
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12.5px] font-medium text-[var(--muted)]">Video team</div>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--ink)]">Video work</h1>
        <p className="mt-1 text-[14px] text-[var(--muted)]">What each editor did — for which client, how many, and who assigned it</p>
      </div>
      <DesignSheet d={sheet} path="/video-team" everyone="All editors" person="Editor" />
      <details className="card !p-0 overflow-hidden" open={!!saved || !!month}>
        <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-medium text-[var(--violet)]">Enter or correct a day · month table · assign work</summary>
        <div className="border-t border-[var(--line)] p-5">{board}</div>
      </details>
    </div>
  );
}
