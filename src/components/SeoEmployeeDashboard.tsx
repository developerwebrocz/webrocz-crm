import { getSeoEmployeeBoard } from "@/lib/queries";
import SeoEmployeeBoard from "@/components/SeoEmployeeBoard";

// SEO Performance working area — the pipeline + per-client editor (matches the uploaded design).
export default async function SeoEmployeeDashboard({ user, month, clientId }: { user: { id: string; name: string; role: string }; month?: string; clientId?: string }) {
  const data = await getSeoEmployeeBoard(user.id, user.role, month);
  return <SeoEmployeeBoard data={data} initialClientId={clientId} />;
}
