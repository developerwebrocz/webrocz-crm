"use client";

import { useEffect, useState } from "react";
import { getWebRoczAccountManagers } from "@/app/webrocz-actions";

// Account-manager picker for the Web Rocz client forms + a hook to resolve a manager's name.
// The list is loaded by the component itself, so the shared pages need no changes.
type Manager = { id: string; name: string };

export function useAccountManagers(): Manager[] | null {
  const [list, setList] = useState<Manager[] | null>(null);
  useEffect(() => {
    let alive = true;
    getWebRoczAccountManagers().then((d) => { if (alive) setList(d); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);
  return list;
}

// Posts the chosen manager's id as `accountManagerId` ("" = not assigned).
export default function WebRoczAccountManagerSelect({ defaultValue = "" }: { defaultValue?: string }) {
  const managers = useAccountManagers();
  const [value, setValue] = useState(defaultValue);
  // Until the names load (or if the saved manager is no longer in the list), keep the saved
  // id selectable so saving the form never clears it by accident.
  const known = !!managers?.some((m) => m.id === value);
  return (
    <select name="accountManagerId" value={value} onChange={(e) => setValue(e.target.value)} className="select mt-1">
      <option value="">— Not assigned —</option>
      {value && !known && <option value={value}>{managers ? "Current manager" : "Loading…"}</option>}
      {(managers ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}
