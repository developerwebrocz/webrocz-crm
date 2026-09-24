import { getApprovals, deptForRole } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { approveUpdate, rejectUpdate } from "@/app/actions";
import { redirect } from "next/navigation";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { Check, RotateCcw, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const APPROVER_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "AM_HEAD", "SEO_HEAD", "DEV_HEAD"];

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!APPROVER_ROLES.includes(user.role)) redirect("/");

  // Heads only approve their own department's work; the Super Admin approves everything.
  const rows = await getApprovals((user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN") ? undefined : deptForRole(user.role) ?? undefined);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Quality control" title="Approvals" sub={`${rows.length} work update${rows.length !== 1 ? "s" : ""} awaiting your sign-off`} />

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <ClipboardCheck size={28} className="text-[var(--emerald)]" />
          <div className="text-[15px] font-bold">All caught up</div>
          <p className="text-sm text-[var(--muted)]">No updates are waiting for approval right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-4">
              <Avatar name={r.user} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{r.user}</span>
                  <span className="badge badge-violet">{r.workType} ×{r.quantity}</span>
                  <span className="text-[13px] text-[var(--muted)]">for {r.client}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                  {r.keyword ? `${r.keyword} · #${r.prevPosition}→#${r.currPosition}` : (r.title || r.detail || "—")}
                  <span className="ml-2 tnum text-[var(--faint)]">{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <form action={rejectUpdate}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-ghost btn-sm"><RotateCcw size={14} /> Send back</button>
                </form>
                <form action={approveUpdate}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-violet btn-sm"><Check size={14} /> Approve</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-[12px] text-[var(--faint)]">Approved work counts toward monthly targets · Sent-back work returns to the team as In Progress.</p>
    </div>
  );
}
