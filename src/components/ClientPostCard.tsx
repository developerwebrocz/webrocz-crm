"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PLATFORMS, PLATFORM_KEYS, POST_TYPES, POST_STATUS, type Platform } from "@/lib/domain";
import { Avatar } from "./ui";
import { Plus, X, Check } from "lucide-react";

type Post = { postType: string; link: string; status: string };
type PF = { platform: string; posts: Post[] };
type Row = { id: string; code: string; name: string; industry: string | null; retainer: number; pocName: string | null; am: string | null; platforms: PF[] };

const blankPost = (): Post => ({ postType: "Post", link: "", status: "SCHEDULED" });

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet btn-sm disabled:opacity-60" disabled={pending}>{pending ? "Saving…" : "Save client"}</button>;
}

export default function ClientPostCard({ row, date, action }: { row: Row; date: string; action: (fd: FormData) => void }) {
  const initActive = row.platforms.filter((p) => PLATFORM_KEYS.includes(p.platform as Platform)).map((p) => p.platform as Platform);
  const initPosts: Record<string, Post[]> = {};
  for (const p of row.platforms) initPosts[p.platform] = p.posts.map((x) => ({ ...x }));

  const [active, setActive] = useState<Platform[]>(initActive);
  const [postsBy, setPostsBy] = useState<Record<string, Post[]>>(initPosts);

  const toggle = (k: Platform) => {
    if (active.includes(k)) setActive(active.filter((x) => x !== k));
    else { setActive([...active, k]); setPostsBy((s) => (s[k]?.length ? s : { ...s, [k]: [blankPost()] })); }
  };
  const selectAll = () => {
    setActive([...PLATFORM_KEYS]);
    setPostsBy((s) => { const n = { ...s }; for (const k of PLATFORM_KEYS) if (!n[k]?.length) n[k] = [blankPost()]; return n; });
  };
  const clearAll = () => setActive([]);
  const addPost = (k: Platform) => setPostsBy((s) => ({ ...s, [k]: [...(s[k] ?? []), blankPost()] }));
  const removePost = (k: Platform, j: number) => setPostsBy((s) => ({ ...s, [k]: (s[k] ?? []).filter((_, i) => i !== j) }));
  const setPost = (k: Platform, j: number, key: keyof Post, val: string) =>
    setPostsBy((s) => ({ ...s, [k]: (s[k] ?? []).map((q, i) => (i === j ? { ...q, [key]: val } : q)) }));

  // keep display order stable (PLATFORM_KEYS order), include only active platforms
  const activeOrdered = PLATFORM_KEYS.filter((k) => active.includes(k));
  const payload = JSON.stringify(
    activeOrdered.flatMap((k) => (postsBy[k] ?? []).map((p) => ({ platform: k, postType: p.postType, link: p.link, status: p.status }))),
  );
  const totalPosts = activeOrdered.reduce((s, k) => s + (postsBy[k]?.length ?? 0), 0);

  return (
    <form action={action} data-adcard className="card card-pad">
      <input type="hidden" name="clientId" value={row.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="payload" value={payload} />

      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={row.name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{row.name}</span>
            {row.industry && <span className="tag">{row.industry}</span>}
            {active.length > 0 && <span className="badge badge-violet">{active.length} platform{active.length > 1 ? "s" : ""} · {totalPosts} post{totalPosts !== 1 ? "s" : ""}</span>}
          </div>
          <div className="text-xs text-[var(--muted)]">POC {row.pocName ?? "—"} · {row.code} · AM {row.am ?? "—"}</div>
        </div>
        <SaveBtn />
      </div>

      {/* platform selection */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Select platforms running for this client</div>
          <div className="flex items-center gap-3 text-[12px]">
            <button type="button" onClick={selectAll} className="font-semibold text-[var(--violet)] hover:underline">Select all</button>
            {active.length > 0 && <button type="button" onClick={clearAll} className="font-semibold text-[var(--muted)] hover:underline">Clear</button>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATFORM_KEYS.map((k) => {
            const on = active.includes(k);
            return (
              <button type="button" key={k} onClick={() => toggle(k)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${on ? "bg-[var(--violet)] text-white" : "border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink)]"}`}>
                {!on && <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${PLATFORMS[k].tone})` }} />} {PLATFORMS[k].label} {on && <Check size={13} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* post blocks for selected platforms */}
      {activeOrdered.length > 0 ? (
        <div className="mt-4 space-y-3">
          {activeOrdered.map((k) => {
            const cfg = PLATFORMS[k];
            const posts = postsBy[k] ?? [];
            return (
              <div key={k} className="rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(--${cfg.tone})` }} />
                  <span className="text-[13.5px] font-bold">{cfg.label}</span>
                  <span className="text-[11.5px] font-semibold text-[var(--muted)] tnum">Posts {posts.length}</span>
                  <button type="button" onClick={() => toggle(k)} className="ml-auto text-[12px] font-semibold text-[var(--rose)] hover:underline">Remove</button>
                </div>
                <div className="mt-3 space-y-2">
                  {posts.map((p, j) => (
                    <div key={j} className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-[var(--faint)] tnum w-10">Post {j + 1}</span>
                      <select value={p.postType} onChange={(e) => setPost(k, j, "postType", e.target.value)} className="select !h-9 !w-auto !py-1.5 !text-[12.5px]">
                        {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={p.link} onChange={(e) => setPost(k, j, "link", e.target.value)} placeholder="Paste link https://…" className="input !h-9 min-w-[180px] flex-1 !text-[12.5px]" />
                      <select value={p.status} onChange={(e) => setPost(k, j, "status", e.target.value)} className="select !h-9 !w-auto !py-1.5 !text-[12.5px] font-semibold">
                        {(Object.entries(POST_STATUS) as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <button type="button" onClick={() => removePost(k, j)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--rose)]"><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addPost(k)} className="text-[12px] font-semibold text-[var(--violet)] hover:underline"><Plus size={12} className="inline" /> Add post</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--r-md)] border border-dashed border-[var(--line-2)] p-4 text-center text-[13px] text-[var(--muted)]">
          Select the platforms running for this client above to log posts.
        </div>
      )}
    </form>
  );
}
