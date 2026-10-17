import { getClientOptions } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreativeNewForm from "@/components/CreativeNewForm";
import { getTypedClientNames } from "@/lib/design-sheet-queries";

export const dynamic = "force-dynamic";

export default async function NewDesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [clients, names] = await Promise.all([getClientOptions(), getTypedClientNames("DESIGN")]); // + the names the design team added
  return <CreativeNewForm kind="DESIGN" clients={clients.map((c) => ({ id: c.id, name: c.name }))} names={names} />;
}
