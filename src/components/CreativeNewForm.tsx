import { addCreativeTask } from "@/app/actions";
import { DESIGN_TYPES, VIDEO_TYPES } from "@/lib/domain";
import { ArrowLeft } from "lucide-react";

export default function CreativeNewForm({ kind, clients }: { kind: "DESIGN" | "VIDEO"; clients: { id: string; name: string }[] }) {
  const isVideo = kind === "VIDEO";
  const back = isVideo ? "/videos" : "/designs";
  const nounOne = isVideo ? "Video" : "Design";
  const types = isVideo ? VIDEO_TYPES : DESIGN_TYPES;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-[720px] px-5 py-8">
        <a href={back} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Back to my {isVideo ? "videos" : "designs"}</a>
        <h1 className="text-[24px] font-extrabold tracking-tight">Add additional {nounOne.toLowerCase()}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">A quick extra task outside the onboarding scope.</p>

        <form action={addCreativeTask} className="card card-pad mt-5 space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <label className="block"><span className="lbl">Title</span><input name="title" required placeholder={isVideo ? "e.g. Instagram Reel 15 sec" : "e.g. Festival Offer Poster"} className="fld2" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="lbl">Client</span>
              <select name="clientId" className="fld2">
                <option value="">— Select client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="lbl">Type</span>
              <select name="type" className="fld2">{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <label className="block"><span className="lbl">Priority</span>
              <select name="priority" defaultValue="MEDIUM" className="fld2"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
            </label>
            <label className="block"><span className="lbl">Due date</span><input type="date" name="dueDate" className="fld2" /></label>
            <label className="block"><span className="lbl">{isVideo ? "Duration" : "Dimensions / size"}</span><input name="dimensions" placeholder={isVideo ? "e.g. 30 sec" : "e.g. 1080×1080 px"} className="fld2" /></label>
            <label className="block"><span className="lbl">Assigned date</span><input type="date" name="assignedDate" className="fld2" /></label>
          </div>
          <label className="block"><span className="lbl">Brief</span><textarea name="brief" rows={3} className="fld2 resize-none" placeholder="What needs to be made…" /></label>
          <label className="block"><span className="lbl">{isVideo ? "Raw footage link" : "Raw assets link"}</span><input name="rawLink" className="fld2" placeholder="Paste link…" /></label>
          <label className="block"><span className="lbl">Reference link</span><input name="refLink" className="fld2" placeholder="Paste link…" /></label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <a href={back} className="rounded-xl border border-[var(--line-2)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--ink)]">Cancel</a>
            <button type="submit" className="btn btn-violet">Add {nounOne.toLowerCase()}</button>
          </div>
        </form>
      </div>
      <style>{`.lbl{display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--faint)}.fld2{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;font-size:13.5px;color:var(--ink);outline:none}.fld2:focus{border-color:var(--violet);box-shadow:0 0 0 3px color-mix(in srgb,var(--violet) 14%,transparent)}`}</style>
    </div>
  );
}
