import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import { TEAMS } from "@/lib/team-kinds";
import EditCountBoard from "@/components/EditCountBoard";
import DesignSheet from "@/components/DesignSheet";
import DayEntryCard from "@/components/DayEntryCard";
import { workTypesFor } from "@/lib/design-work";
import { getDesignSheet, getTypedClientNames } from "@/lib/design-sheet-queries";

export const dynamic = "force-dynamic";

// Design team "Design Count": each designer's designs per day (the designers' Google Sheet).
// Designers see their own; the design team lead and admins see everyone, assign design work
// and can load the old sheet. Same page as the video team's Editing Count, for the designers.
export default async function DesignTeamPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenEditCount(user, "DESIGN")) redirect("/");
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : "";
  const d = await getEditCountBoard(user, month, "DESIGN");
  // designers name the client of each design they log, so everyone gets the client list
  const clients = (await getClientOptions()).map((c) => ({ id: c.id, name: c.name }));
  const board = <EditCountBoard team={TEAMS.DESIGN} d={d} me={{ id: user.id, name: user.name, isEditor: user.role === "DESIGNER", isAdmin: isVideoAdmin(user) }} clients={clients} saved={saved} />;
  // a designer: their own page — enter the day client by client, and their work as a sheet
  if (!d.seeAll) {
    const q0 = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
    const mineSheet = await getDesignSheet({ period: q0("period") || "week", client: q0("client"), designer: user.id }, "DESIGN");
    const myDays: Record<string, { count: number; note: string; items: { client: string; type: string; count: number }[] }> = {};
    for (const [k, c] of Object.entries(d.cells)) { const [uid, day] = k.split("|"); if (uid === user.id) myDays[day] = { count: c.count, note: c.note, items: c.items }; }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">My designs</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">Enter what you designed each day — client by client</p>
        </div>
        <DayEntryCard team="DESIGN" today={d.today} firstDay={`${d.month}-01`} days={myDays} clientNames={[...(await getTypedClientNames("DESIGN")), ...clients.map((c) => c.name)]} types={workTypesFor("DESIGN")} noun="design" saved={saved === "1"} />
        <DesignSheet d={mineSheet} path="/design-team" mine title="My designs" />
      </div>
    );
  }
  // Super Admin / design lead: the team's work as one simple sheet first; entering or
  // correcting a day, the month table and assigning work are folded underneath
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const sheet = await getDesignSheet({ period: q("period"), client: q("client"), designer: q("designer") });
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12.5px] font-medium text-[var(--muted)]">Design team</div>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--ink)]">Design work</h1>
        <p className="mt-1 text-[14px] text-[var(--muted)]">What each designer did — for which client, how many, and who assigned it</p>
      </div>
      <DesignSheet d={sheet} />
      <details className="card !p-0 overflow-hidden" open={!!saved || !!month}>
        <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-medium text-[var(--violet)]">Enter or correct a day · month table · assign work</summary>
        <div className="border-t border-[var(--line)] p-5">{board}</div>
      </details>
    </div>
  );
}
