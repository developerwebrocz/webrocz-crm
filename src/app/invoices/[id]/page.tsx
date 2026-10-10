import { getInvoiceById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvoiceView from "@/components/InvoiceView";
import InvoiceReceipts, { InvoiceReceiptNotice } from "@/components/InvoiceReceipts";

export const dynamic = "force-dynamic";

// /invoices is the accountant + Super Admin area. Sales see their own invoice at /sales/[id]/invoice.
const VIEW_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function InvoiceByIdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!VIEW_ROLES.includes(user.role)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const d = await getInvoiceById(id);
  if (!d) redirect("/invoices");
  const sent = sp.sent === "1" ? "ok" : sp.sent === "0" ? "fail" : sp.sent === "locked" ? "locked" : sp.sent === "dupno" ? "dupno" : "";
  const isSuperAdmin = ["SUPER_ADMIN", "SUB_ADMIN"].includes(user.role);
  const canManage = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"].includes(user.role);
  const pipeline = (d.invoice as { pipeline?: string } | null)?.pipeline;
  const lead = d.lead ? { id: d.lead.id, startDate: d.lead.startDate, pipeline } : { id: "", pipeline };
  const approvalOff = user.role === "ACCOUNTANT"; // accountant CRM has no approval gate
  return (
    <>
      {/* before payment the client gets the invoice; after payment, the receipt */}
      {canManage && <InvoiceReceiptNotice invoiceId={id} total={Number((d.invoice as { total?: number } | null)?.total ?? 0)} received={Number((d.invoice as { received?: number } | null)?.received ?? 0)} />}
      <InvoiceView lead={lead} invoice={d.invoice} canManage={canManage} isSuperAdmin={isSuperAdmin} approvalOff={approvalOff} sent={sent} backHref="/invoices" />
      {/* payments received on this invoice, each with its receipt to send */}
      <InvoiceReceipts invoiceId={id} />
    </>
  );
}
