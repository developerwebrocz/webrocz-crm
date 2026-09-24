import { getLeadInvoice } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvoiceView from "@/components/InvoiceView";

export const dynamic = "force-dynamic";

const SALES_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SALES_HEAD", "SALES_EXEC"];

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!SALES_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const d = await getLeadInvoice(id);
  if (!d) redirect("/sales");
  const sent = sp.sent === "1" ? "ok" : sp.sent === "0" ? "fail" : sp.sent === "locked" ? "locked" : "";
  const isSuperAdmin = ["SUPER_ADMIN", "SUB_ADMIN"].includes(user.role);
  return <InvoiceView lead={d.lead} invoice={d.invoice} canManage={SALES_ROLES.includes(user.role)} isSuperAdmin={isSuperAdmin} sent={sent} backHref={`/sales/${id}`} />;
}
