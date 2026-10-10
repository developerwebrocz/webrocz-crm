"use client";

import { useState } from "react";
import { Plus, Film } from "lucide-react";
import { JobModal, type VideoJobFormOpts } from "@/components/ClientVideosBoard";

// Team lead's dashboard: "Assign client videos" — opens the client-shoot form (client, videos
// shot, shot by, editors). `presetEditorId` ticks one editor ("assign to Madhu").
export default function AssignClientVideosButton({ form, meId, presetEditorId = "", label = "Assign client videos", variant = "primary" }: { form: VideoJobFormOpts; meId: string; presetEditorId?: string; label?: string; variant?: "primary" | "soft" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "primary"
        ? <button type="button" onClick={() => setOpen(true)} className="btn btn-violet"><Film size={15} /> {label}</button>
        : <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-[var(--line-2)] text-[12px] font-bold text-[var(--violet)] transition hover:border-[var(--violet)] hover:bg-[color-mix(in_srgb,var(--violet)_6%,white)]"><Plus size={13} /> {label}</button>}
      {open && <JobModal d={form} row={null} meId={meId} ret="/" presetEditorId={presetEditorId} title={label} close={() => setOpen(false)} />}
    </>
  );
}
