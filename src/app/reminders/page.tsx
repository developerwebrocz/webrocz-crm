import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentReminderRows } from "@/lib/payment-reminders";
import { Eyebrow } from "@/components/ui";
import PaymentReminders from "@/components/PaymentReminders";

export const dynamic = "force-dynamic";

// Payment Reminders — the accounts team's reminder pipeline: Overdue → Today → This week → Later.
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function RemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const rows = await getPaymentReminderRows();
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Accounts · payment follow-up</Eyebrow>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Payment Reminders</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">Every invoice with payment pending, by when the client has to be reminded. Send the reminder on WhatsApp, note what the client said, and pick the next date.</p>
      </div>
      <PaymentReminders rows={rows} pageSize={25} />
    </div>
  );
}
