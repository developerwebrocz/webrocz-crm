"use client";


export default function AmPicker({ ams, active }: { ams: { id: string; name: string }[]; active: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">Viewing as</span>
      <select className="select !w-auto" value={active} onChange={(e) => window.location.assign(`/am?am=${e.target.value}`)}>
        {ams.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  );
}
