"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PLATFORMS, PLATFORM_KEYS, POST_TYPES, inrShort } from "@/lib/domain";
import { Avatar } from "./ui";
import { Plus, X } from "lucide-react";

type Post = { postType: string; link: string; status: string };
type PF = { platform: string; posts: Post[] };
type Row = { id: string; code: string; name: string; industry: string | null; retainer: number; pocName: string | null; am: string | null; platforms: PF[] };

const blankPost = (): Post => ({ postType: "Post", link: "", status: "SCHEDULED" });

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button className="btn btn-violet btn-sm disabled:opacity-60" disabled={pending}>{pending ? "Saving…" : "Save client"}</button>;
}

export default function ClientPostCard({ row, date, action }: { row: Row; date: string; action: (fd: FormData) => void }) {
  const [platforms, setPlatforms] = useState<PF[]>(row.platforms.map((p) => ({ platform: p.platform, posts: p.posts.map((x) => ({ ...x })) })));

  const usedPlatforms = platforms.map((p) => p.platform);
  const nextPlatform = PLATFORM_KEYS.find((k) => !usedPlatforms.includes(k)) ?? PLATFORM_KEYS[0];

  const addPlatform = () => setPlatforms((s) => [...s, { platform: nextPlatform, posts: [blankPost()] }]);
  const removePlatform = (i: number) => setPlatforms((s) => s.filter((_, idx) => idx !== i));
  const setPlatform = (i: number, platform: string) => setPlatforms((s) => s.map((p, idx) => (idx === i ? { ...p, platform } : p)));
  const addPost = (i: number) => setPlatforms((s) => s.map((p, idx) => (idx === i ? { ...p, posts: [...p.posts, blankPost()] } : p)));
  const removePost = (i: number, j: number) => setPlatforms((s) => s.map((p, idx) => (idx === i ? { ...p, posts: p.posts.filter((_, k) => k !== j) } : p)));
  const setPost = (i: number, j: number, key: keyof Post, val: string) =>
    setPlatforms((s) => s.map((p, idx) => (idx === i ? { ...p, posts: p.posts.map((q, k) => (k === j ? { ...q, [key]: val } : q)) } : p)));

  const payload = JSON.stringify(
    platforms.flatMap((pf) => pf.posts.map((p) => ({ platform: pf.platform, postType: p.postType, link: p.link, status: p.status }))),
  );
  const totalPosts = platforms.reduce((s, p) => s + p.posts.length, 0);

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
            {platforms.length > 0 && <span className="badge badge-violet">{platforms.length} platform{platforms.length > 1 ? "s" : ""} · {totalPosts} posts</span>}
          </div>
          <div className="text-xs text-[var(--muted)]">{inrShort(row.retainer)} · POC {row.pocName ?? "—"} · {row.code} · AM {row.am ?? "—"}</div>
        </div>
        <button type="button" onClick={addPlatform} className="btn btn-ghost btn-sm"><Plus size={14} /> Add platform</button>
        <SaveBtn />
      </div>

      {/* platform blocks */}
      <div className="mt-4 space-y-3">
        {platforms.map((pf, i) => {
          const cfg = PLATFORMS[pf.platform as keyof typeof PLATFORMS];
          return (
            <div key={i} className="rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: `var(--${cfg?.tone ?? "violet"})` }} />
                <select value={pf.platform} onChange={(e) => setPlatform(i, e.target.value)} className="select !h-9 !w-auto !py-1.5 !text-[13px] font-semibold">
                  {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORMS[k].label}</option>)}
                </select>
                <span className="text-[11.5px] font-semibold text-[var(--muted)] tnum">Posts {pf.posts.length}</span>
                <button type="button" onClick={() => removePlatform(i)} className="ml-auto text-[12px] font-semibold text-[var(--rose)] hover:underline">Remove</button>
              </div>

              <div className="mt-3 space-y-2">
                {pf.posts.map((p, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[var(--faint)] tnum w-10">Post {j + 1}</span>
                    <select value={p.postType} onChange={(e) => setPost(i, j, "postType", e.target.value)} className="select !h-9 !w-auto !py-1.5 !text-[12.5px]">
                      {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      value={p.link} onChange={(e) => setPost(i, j, "link", e.target.value)}
                      placeholder="Paste link https://…"
                      className="input !h-9 min-w-[180px] flex-1 !text-[12.5px]"
                    />
                    <select value={p.status} onChange={(e) => setPost(i, j, "status", e.target.value)} className="select !h-9 !w-auto !py-1.5 !text-[12.5px] font-semibold">
                      <option value="POSTED">Posted</option>
                      <option value="SCHEDULED">Scheduled</option>
                    </select>
                    <button type="button" onClick={() => removePost(i, j)} className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--rose)]"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => addPost(i)} className="text-[12px] font-semibold text-[var(--violet)] hover:underline">+ Add post</button>
              </div>
            </div>
          );
        })}
        {platforms.length === 0 && (
          <div className="rounded-[var(--r-md)] border border-dashed border-[var(--line-2)] p-4 text-center text-[13px] text-[var(--muted)]">
            No platforms yet — click <span className="font-semibold text-[var(--ink-2)]">Add platform</span> to log this client&apos;s posts.
          </div>
        )}
      </div>
    </form>
  );
}
