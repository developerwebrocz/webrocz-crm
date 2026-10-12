import { getTeamOverview } from "@/lib/queries";
import { createUser } from "@/app/actions";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import AddMemberForm from "@/components/AddMemberForm";
import TeamTable from "@/components/TeamTable";
import { emailSetup } from "@/lib/email";
import { sendTestEmail } from "@/app/actions";
import { Users, UserCheck, CheckCircle2, Clock, Mail, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const { members, totals, monthLabel } = await getTeamOverview();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const mail = emailSetup();
  // what the last "add member" / "resend invite" / "test email" did
  const note = one("mail") === "invited" ? { ok: true, text: `Invite email sent to ${one("to") || "the member"} — they set their own password from it.` }
    : one("mail") === "pwset" ? { ok: true, text: `Password set for ${one("to")}. Their login: the email on their row + the password you typed, at the Team Portal (/staff).` }
    : one("mail") === "test" ? { ok: true, text: `Test email sent to ${one("to")}. Check that inbox (and Spam).` }
    : one("mail") === "off" ? { ok: false, text: `${one("to") || "The member"} was added, but no invite email was sent — the email service is not set up on the server. Use “Copy login link” and send it to them.` }
    : one("mail") === "fail" ? { ok: false, text: /password was not changed/.test(one("why")) ? one("why") : `Email was NOT sent. ${one("why")}` }
    : null;

  const kpis = [
    { label: "Team members", value: totals.members, icon: Users, tone: "var(--violet)" },
    { label: "Active", value: totals.active, icon: UserCheck, tone: "var(--emerald)" },
    { label: `Output · ${monthLabel.split(" ")[0]}`, value: totals.output, icon: CheckCircle2, tone: "var(--sky)" },
    { label: "Pending approval", value: totals.pending, icon: Clock, tone: "var(--amber)" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Organisation" title="Team" sub={`Every member's workload and output this month · ${monthLabel}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{k.label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in srgb, ${k.tone} 12%, white)`, color: k.tone }}><k.icon size={15} /></span>
            </div>
            <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tnum">{k.value}</div>
          </div>
        ))}
      </div>

      {note && (
        <p className="flex items-start gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: `color-mix(in srgb, ${note.ok ? "var(--emerald)" : "var(--rose)"} 9%, white)`, color: note.ok ? "var(--emerald)" : "var(--rose)" }}>
          {note.ok ? <CheckCircle2 size={15} className="mt-0.5 flex-none" /> : <AlertTriangle size={15} className="mt-0.5 flex-none" />} {note.text}
        </p>
      )}

      {/* invite emails: on / off, from which mailbox, and a test button */}
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3" style={mail.on ? undefined : { borderColor: "color-mix(in srgb, var(--amber) 35%, white)", background: "color-mix(in srgb, var(--amber) 6%, white)" }}>
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${mail.on ? "var(--emerald)" : "var(--amber)"} 13%, white)`, color: mail.on ? "var(--emerald)" : "var(--amber)" }}><Mail size={16} /></span>
          <div>
            <div className="text-[14px] font-bold">{mail.on ? "Invite emails are ON" : "Invite emails are OFF"}</div>
            <div className="text-[12.5px] text-[var(--muted)]">
              {mail.on
                ? <>Sent from <b>{mail.from}</b> through {mail.via}. A new member gets an email with a link to set their password.</>
                : <>The server has no mailbox to send from, so a new member gets no email. Until it is set up, use <b>Copy login link</b> on the member’s row.</>}
            </div>
          </div>
        </div>
        {mail.on && <form action={sendTestEmail}><button type="submit" className="btn btn-ghost btn-sm"><Mail size={14} /> Send test email to me</button></form>}
      </div>

      <TeamTable members={members} emailOn={mail.on} />

      <Card>
        <Eyebrow>Add team member</Eyebrow>
        <div className="mt-3"><AddMemberForm action={createUser} /></div>
      </Card>
    </div>
  );
}
