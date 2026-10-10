// Reading the video team's old Google Sheet (CSV) — shared by the "Import sheet" buttons in the
// CRM and by the server script prisma/video-team-setup.ts. Plain functions only (no database,
// no Next.js imports), so both can use them.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  const src = text.replace(/^﻿/, "").replace(/\r/g, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).filter((r) => r.some((c) => c !== ""));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "01 / Aug / 26" · 01-08-2026 · 01/08/26 (day first, as in India) · 2026-08-01 → "2026-08-01"
export function sheetDate(v: string): string {
  const p = v.replace(/\s+/g, "").split(/[-/.]/);
  if (p.length !== 3 || p.some((x) => !x)) return "";
  let y: number, m: number, d: number;
  if (/^\d{4}$/.test(p[0])) { y = +p[0]; m = +p[1]; d = +p[2]; }
  else { d = +p[0]; m = /^\d+$/.test(p[1]) ? +p[1] : MONTHS.indexOf(p[1].slice(0, 3).toLowerCase()) + 1; y = +p[2]; if (y < 100) y += 2000; }
  if (!y || !m || !d || m > 12 || d > 31) return "";
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).getUTCDate() === d ? iso : "";
}

export const normText = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// letters that differ between two words (insert / delete / change), small words only
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// A name from the sheet → the one team member it means: the same name, the same first name, or
// a first name that is one letter off ("Poorna" in the sheet, "Poona" in Team). No match when
// it could be two people.
export function matchPerson<T extends { name: string }>(name: string, people: T[]): T | null {
  const n = normText(name);
  if (!n) return null;
  const first = (v: string) => normText(v).split(" ")[0] ?? "";
  let hit = people.filter((p) => normText(p.name) === n);
  if (hit.length === 1) return hit[0];
  hit = people.filter((p) => first(p.name) === first(name));
  if (hit.length === 1) return hit[0];
  if (hit.length > 1) return null;
  hit = people.filter((p) => first(p.name).length >= 4 && first(name).length >= 4 && distance(first(p.name), first(name)) <= 1);
  return hit.length === 1 ? hit[0] : null;
}

type Person = { id: string; name: string };

// ---- "Editing Count" sheet: first column the date, then one column per editor ----
export function planEditCounts(csv: string, editors: Person[], today: string) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { error: "That file has no rows." as const };
  const head = rows[0];
  if (!/date/i.test(head[0] ?? "")) return { error: "The first column must be \"Date\", followed by one column per editor." as const };
  const cols: { i: number; name: string; user: Person | null }[] = [];
  head.forEach((h, i) => { if (i > 0 && h && !/^total$/i.test(h)) cols.push({ i, name: h, user: matchPerson(h, editors) }); });
  const matched = cols.filter((c) => c.user);
  const missing = cols.filter((c) => !c.user).map((c) => c.name);
  if (!matched.length) return { error: `No column matches a Video Editor in Team. Columns found: ${cols.map((c) => c.name).join(", ") || "none"}.` };

  const data: { userId: string; date: string; count: number }[] = [];
  const badDates: string[] = [];
  let future = 0, badCells = 0;
  for (const r of rows.slice(1)) {
    if (/^(month )?total/i.test(r[0] ?? "")) continue;
    const date = sheetDate(r[0] ?? "");
    if (!date) { if (r[0]) badDates.push(r[0]); continue; }
    if (date > today) { future++; continue; }
    for (const c of matched) {
      const v = r[c.i] ?? "";
      if (v === "") continue; // blank = no entry that day (leave / holiday)
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 500) { badCells++; continue; }
      data.push({ userId: c.user!.id, date, count: Math.round(n) });
    }
  }
  if (!data.length) return { error: "No counts found in that file." as const };
  const perEditor = matched.map((c) => {
    const mine = data.filter((d) => d.userId === c.user!.id);
    return `${c.user!.name}${normText(c.user!.name) !== normText(c.name) ? ` (sheet: ${c.name})` : ""}: ${mine.length} days · ${mine.reduce((s, d) => s + d.count, 0)} in total`;
  });
  return { data, perEditor, missing, badDates, badCells, future };
}

// ---- "Video Shoots Status" sheet: one row per client shoot ----
export type VideoJobData = {
  date: string; clientName: string; clientId: string | null; shotBy: string; videosShot: number; edited: number; editStatus: string;
  editorIds: string; editorNames: string; informedAM: boolean; posting: string; verifiedBy: string; storage: string;
};

export function planVideoJobs(csv: string, editors: Person[], clients: Person[], existing: { id: string; date: string; clientName: string }[], today: string) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { error: "That file has no rows." as const };
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const C = {
    date: head.findIndex((h, i) => h.includes("date") || (i === 0 && h === "")),
    shotBy: col("employee", "shot by", "shooter"), client: col("client"), shot: col("shoot", "shot"),
    status: col("editing status", "edit status", "status"), editors: col("editor"), informed: col("informed"),
    posting: col("posting"), verified: col("verified"), storage: col("storage"),
  };
  if (C.client < 0 || C.date < 0) return { error: "The file needs a Date column and a Client column." as const };
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
  const clientByName = (name: string) => { const hit = clients.filter((c) => normText(c.name) === normText(name)); return hit.length === 1 ? hit[0].id : null; };

  // The same client can have two shoots on one day: the 1st row in the file replaces the 1st
  // saved one, the 2nd the 2nd … so importing the same file again never doubles anything.
  const have = new Map<string, string>(); const seenSaved = new Map<string, number>();
  for (const j of existing) { const k = `${j.date}|${normText(j.clientName)}`; const n = (seenSaved.get(k) ?? 0) + 1; seenSaved.set(k, n); have.set(`${k}#${n}`, j.id); }
  const seenFile = new Map<string, number>();

  const ops: { id: string | null; data: VideoJobData }[] = [];
  let linked = 0;
  const badDates: string[] = []; const noLogin = new Map<string, number>();
  for (const r of rows.slice(1)) {
    const clientName = get(r, C.client);
    if (!clientName || /^x+$/i.test(clientName)) continue; // the sheet's sample row
    const date = sheetDate(get(r, C.date));
    if (!date || date > today) { badDates.push(`${get(r, C.date) || "(no date)"} · ${clientName}`); continue; }
    const st = get(r, C.status);
    const noEdit = /no\s*need/i.test(st);
    const num = (st.match(/\d+/) || [])[0];
    const edited = noEdit ? 0 : num ? Number(num) : 0;
    const videosShot = Number((get(r, C.shot).match(/\d+/) || [])[0] ?? 0);
    const editStatus = noEdit ? "NO_EDIT" : /complet|done/i.test(st) ? "COMPLETED" : edited > 0 ? "IN_PROGRESS" : "PENDING";
    const ids: string[] = []; const others: string[] = [];
    for (const name of get(r, C.editors).split(/[,&/]|\band\b/i).map((x) => x.trim()).filter(Boolean)) {
      const u = matchPerson(name, editors);
      if (u) { if (!ids.includes(u.id)) ids.push(u.id); } else { others.push(name); noLogin.set(name, (noLogin.get(name) ?? 0) + 1); }
    }
    const posting = get(r, C.posting);
    // a drive size typed in the "Verified By" column ("8TB") is the storage, not a person
    const verified = get(r, C.verified);
    const driveInVerified = /^\d+\s*tb$/i.test(verified);
    const clientId = clientByName(clientName);
    if (clientId) linked++;
    const key = `${date}|${normText(clientName)}`;
    const nth = (seenFile.get(key) ?? 0) + 1; seenFile.set(key, nth);
    ops.push({
      id: have.get(`${key}#${nth}`) ?? null,
      data: {
        date, clientName, clientId, shotBy: get(r, C.shotBy).split(",").map((x) => x.trim()).filter(Boolean).join(", "),
        videosShot, edited, editStatus, editorIds: JSON.stringify(ids), editorNames: others.join(", "),
        informedAM: /^y/i.test(get(r, C.informed)), posting: /posted/i.test(posting) ? "POSTED" : /pending/i.test(posting) ? "PENDING" : "",
        verifiedBy: driveInVerified ? "" : verified, storage: get(r, C.storage) || (driveInVerified ? verified : ""),
      },
    });
  }
  if (!ops.length) return { error: "No client rows found in that file." as const };
  return { ops, added: ops.filter((o) => !o.id).length, replaced: ops.filter((o) => o.id).length, linked, badDates, noLogin: [...noLogin].map(([n, c]) => `${n} (${c})`) };
}

// ---- Designers' "Assigned Postings" sheet: Designer, Client, Monthly posts, Total post, Done, Note ----
export type DesignPostingData = { userId: string; clientName: string; clientId: string | null; monthlyPosts: number; target: number; done: number; note: string };

export function planDesignPostings(csv: string, designers: Person[], clients: Person[], existing: { id: string; userId: string; clientName: string }[]) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { error: "That file has no rows." as const };
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const C = { designer: col("designer", "employee"), client: col("client"), monthly: col("monthly"), total: col("total"), done: col("done"), note: col("note", "status") };
  if (C.designer < 0 || C.client < 0) return { error: "The file needs a Designer column and a Client column." as const };
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? "" : "");
  const num = (v: string) => { const m = v.match(/\d+/); return m ? Number(m[0]) : 0; };
  const clientByName = (name: string) => { const hit = clients.filter((c) => normText(c.name) === normText(name)); return hit.length === 1 ? hit[0].id : null; };

  // the same designer + client already in that week is replaced (1st with 1st, 2nd with 2nd …)
  const have = new Map<string, string>(); const seenSaved = new Map<string, number>();
  for (const e of existing) { const k = `${e.userId}|${normText(e.clientName)}`; const n = (seenSaved.get(k) ?? 0) + 1; seenSaved.set(k, n); have.set(`${k}#${n}`, e.id); }
  const seenFile = new Map<string, number>();

  const ops: { id: string | null; data: DesignPostingData }[] = [];
  const missing = new Set<string>();
  for (const r of rows.slice(1)) {
    const clientName = get(r, C.client);
    const who = get(r, C.designer);
    if (!clientName || !who) continue;
    const user = matchPerson(who, designers);
    if (!user) { missing.add(who); continue; }
    const monthlyPosts = num(get(r, C.monthly));
    const totalRaw = get(r, C.total);
    const key = `${user.id}|${normText(clientName)}`;
    const nth = (seenFile.get(key) ?? 0) + 1; seenFile.set(key, nth);
    ops.push({ id: have.get(`${key}#${nth}`) ?? null, data: { userId: user.id, clientName, clientId: clientByName(clientName), monthlyPosts, target: totalRaw === "" ? Math.ceil(monthlyPosts / 4) : num(totalRaw), done: num(get(r, C.done)), note: get(r, C.note) } });
  }
  if (!ops.length) return { error: missing.size ? `No row matches a Designer in Team. Names in the file: ${[...missing].join(", ")}.` : "No client rows found in that file." };
  const perDesigner = designers.filter((d) => ops.some((o) => o.data.userId === d.id)).map((d) => {
    const mine = ops.filter((o) => o.data.userId === d.id);
    return `${d.name}: ${mine.length} clients · ${mine.reduce((s, o) => s + o.data.done, 0)} of ${mine.reduce((s, o) => s + o.data.target, 0)} posts done`;
  });
  return { ops, added: ops.filter((o) => !o.id).length, replaced: ops.filter((o) => o.id).length, missing: [...missing], perDesigner };
}
