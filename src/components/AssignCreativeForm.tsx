"use client";

import { useMemo, useState } from "react";
import { assignCreativeTask } from "@/app/actions";
import { DESIGN_TYPES, VIDEO_TYPES } from "@/lib/domain";
import { Send, X, Palette, Clapperboard } from "lucide-react";

type Member = { id: string; name: string; role: string };
type ClientOpt = { id: string; name: string };

export default function AssignCreativeForm({ members, clients }: { members: Member[]; clients: ClientOpt[] }) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");

  const member = useMemo(() => members.find((m) => m.id === memberId), [members, memberId]);
  const isVideo = member?.role === "EDITOR";
  const types = isVideo ? VIDEO_TYPES : DESIGN_TYPES;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-violet"><Send size={15} /> Assign to Design / Video team</button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-[560px] max-h-[92vh] overflow-hidden rounded-[18px] border border-[var(--line-2)] bg-[var(--surface)] shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
              <div>
                <h2 className="text-[16px] font-bold">Assign creative work</h2>
                <p className="text-[12px] text-[var(--muted)]">Prepare the brief and send it to a designer or video editor — it lands on their board and notifies them.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
            </div>
            <form action={assignCreativeTask} className="flex flex-col gap-4 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="eyebrow">Assign to</span>
                  <select name="assignedToId" required value={memberId} onChange={(e) => setMemberId(e.target.value)} className="select mt-1.5">
                    <option value="">— Select team member —</option>
                    <optgroup label="Designers">{members.filter((m) => m.role === "DESIGNER").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                    <optgroup label="Video Editors">{members.filter((m) => m.role === "EDITOR").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                  </select>
                </label>
                <label className="block"><span className="eyebrow">Client</span>
                  <select name="clientId" className="select mt-1.5"><option value="">— Select client —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </label>
              </div>

              {member && (
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${isVideo ? "var(--rose)" : "var(--amber)"} 12%, white)`, color: isVideo ? "var(--rose)" : "var(--amber)" }}>
                  {isVideo ? <Clapperboard size={13} /> : <Palette size={13} />} {isVideo ? "Video Editor" : "Graphic Designer"} · goes to their {isVideo ? "Video" : "Design"} Studio
                </div>
              )}

              <label className="block"><span className="eyebrow">Title</span><input name="title" required placeholder={isVideo ? "e.g. Diwali Offer Reel 15 sec" : "e.g. Instagram Offer Creative"} className="input mt-1.5" /></label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="eyebrow">Type</span>
                  <select name="type" className="select mt-1.5">{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="block"><span className="eyebrow">Priority</span>
                  <select name="priority" defaultValue="MEDIUM" className="select mt-1.5"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
                </label>
                <label className="block"><span className="eyebrow">Due date</span><input type="date" name="dueDate" className="input mt-1.5" /></label>
              </div>

              <label className="block"><span className="eyebrow">Brief / content</span><textarea name="brief" rows={3} placeholder="Content, offer text, sizes, brand notes…" className="textarea mt-1.5" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="eyebrow">Reference link</span><input name="refLink" placeholder="Paste link…" className="input mt-1.5" /></label>
                <label className="block"><span className="eyebrow">{isVideo ? "Raw footage link" : "Raw assets link"}</span><input name="rawLink" placeholder="Paste link…" className="input mt-1.5" /></label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-violet"><Send size={14} /> Assign &amp; notify</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
