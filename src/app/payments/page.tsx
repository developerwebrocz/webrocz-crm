import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPaymentsPipeline } from "@/lib/payments-queries";
import PaymentsPipeline from "@/components/PaymentsPipeline";

export const dynamic = "force-dynamic";

const ALLOWED = ["ACCOUNTANT", "SUPER_ADMIN", "SUB_ADMIN"];

// Payments pipeline: clients with payment pending / fully received, and the daily collection
// by accountant. (The older plain ledger lives on in components/FinancePayments.tsx.)
export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ALLOWED.includes(user.role)) redirect("/");
  const data = await getPaymentsPipeline();
  // Today's date in India (UTC+5:30), where the accounts team works.
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return <PaymentsPipeline invoices={data.invoices} payments={data.payments} clients={data.clients} today={today} canReassign={user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN"} />;
}
