import { getClientOptions } from "@/lib/queries";
import { getVideoTeamNames } from "@/lib/video-job-queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeNewForm from "@/components/CreativeNewForm";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [clients, teamNames] = await Promise.all([getClientOptions(), getVideoTeamNames()]);
  // the agency's own brands and the names the video team added — shown above the clients
  const taken = new Set(clients.map((c) => c.name.trim().toLowerCase()));
  return <CreativeNewForm kind="VIDEO" clients={clients.map((c) => ({ id: c.id, name: c.name }))} names={teamNames.filter((n) => !taken.has(n.toLowerCase()))} />;
}
