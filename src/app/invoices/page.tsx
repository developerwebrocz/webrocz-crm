import { getInvoices } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvoicesDashboard from "@/components/InvoicesDashboard";

export const dynamic = "force-dynamic";

const DASH_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!DASH_ROLES.includes(user.role)) redirect("/");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const d = await getInvoices({ q, status });
  return <InvoicesDashboard rows={d.rows} totals={d.totals} q={q} status={status} />;
}
