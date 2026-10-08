"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getWebRoczPvtClientFollowups } from "@/app/webrocz-pvt-actions";
import ClientFollowupChannels, { type ClientFollowup } from "@/components/ClientFollowupChannels";

// Follow-up popup opened from a client's row on the Web Rocz Pvt Ltd invoices list: the
// client's Phone and WhatsApp follow-ups, each logged and listed separately. It loads the
// client's follow-ups itself, so the shared invoices page needs no extra data.
export default function WebRoczPvtFollowupModal({ clientId, name, close }: { clientId: string; name: string; close: () => void }) {
  const [followups, setFollowups] = useState<ClientFollowup[] | null>(null);
  useEffect(() => {
    let alive = true;
    getWebRoczPvtClientFollowups(clientId).then((f) => { if (alive) setFollowups(f); }).catch(() => { if (alive) setFollowups([]); });
    return () => { alive = false; };
  }, [clientId]);
  // After saving, come back to the invoices list the popup was opened from.
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/invoices?company=WEB_ROCZ_PVT";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(16,19,34,.5)", backdropFilter: "blur(4px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--surface)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold">Follow-up · {name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{followups === null ? "Loading follow-ups…" : `${followups.length} follow-up${followups.length === 1 ? "" : "s"} logged`}</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[var(--line-2)] text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto scroll-thin px-6 py-4">
          <ClientFollowupChannels clientId={clientId} returnTo={here} followups={followups ?? []} />
        </div>
        <div className="flex justify-end border-t border-[var(--line)] px-6 py-3"><button type="button" onClick={close} className="btn btn-ghost">Close</button></div>
      </div>
    </div>
  );
}
