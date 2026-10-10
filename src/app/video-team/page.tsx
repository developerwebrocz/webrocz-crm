import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientOptions } from "@/lib/queries";
import { getEditCountBoard, canOpenEditCount, isVideoAdmin } from "@/lib/edit-count-queries";
import EditCountBoard from "@/components/EditCountBoard";

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
  const clients = d.seeAll ? (await getClientOptions()).map((c) => ({ id: c.id, name: c.name })) : [];
  return <EditCountBoard d={d} me={{ id: user.id, name: user.name, isEditor: user.role === "EDITOR", isAdmin: isVideoAdmin(user) }} clients={clients} saved={saved} />;
}
