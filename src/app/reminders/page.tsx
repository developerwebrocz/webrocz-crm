import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentReminders } from "@/lib/payment-reminders";
import { Eyebrow } from "@/components/ui";
import PaymentReminders from "@/components/PaymentReminders";

export const dynamic = "force-dynamic";

// Payment Reminders — the accounts team's reminder pipeline: Overdue → Today → This week → Later.
const ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "ACCOUNTANT"];

export default async function RemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ROLES.includes(user.role)) redirect("/");
  const rows = await getPaymentReminders(user.role);
  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Accounts · payment follow-up</Eyebrow>
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight">Payment Reminders</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">The follow-ups you set, by their date. In a client’s or invoice’s Follow-up, write the note and pick “Follow up again on” (tomorrow, or any date) — it shows here on that day.</p>
      </div>
      <PaymentReminders rows={rows} pageSize={25} mineFirst={user.role === "SUPER_ADMIN"} />
    </div>
  );
}
