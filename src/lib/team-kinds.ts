// The creative teams that keep a daily count and have a team lead: the video editors
// ("Editing Count") and the designers ("Design Count"). One set of pages serves both; this
// says what differs — the role, the page and the words.
// The agency's own brands the video team makes videos for (its reels, ads, office shoots).
// They are names only — not client records, so they never show in Clients or the accounts lists.
// The video team can add more names of their own ("＋ New Client" on Add Video); those are kept
// the same way, as a name on the video.
export const OWN_BRANDS = ["Web Rocz", "Digital Hat", "Studio X", "Show Yours", "Talk X", "Rajesh Sir (Personal Branding)", "Prathibha IAS", "Prathibha Degree"];
export const NAME_ONLY = "name:"; // pick-list value prefix: "name:Digital Hat" = this name, no client record

export type TeamKind = "VIDEO" | "DESIGN";
export type TeamInfo = {
  kind: TeamKind; role: string; path: string; title: string; eyebrow: string;
  one: string; many: string; did: string; person: string; member: string;
};
export const TEAMS: Record<TeamKind, TeamInfo> = {
  VIDEO: { kind: "VIDEO", role: "EDITOR", path: "/video-team", title: "Editing Count", eyebrow: "Video team", one: "video", many: "videos", did: "edited", person: "editor", member: "Video editor" },
  DESIGN: { kind: "DESIGN", role: "DESIGNER", path: "/design-team", title: "Design Count", eyebrow: "Design team", one: "design", many: "designs", did: "done", person: "designer", member: "Designer" },
};
export const teamOf = (v: unknown): TeamInfo => (v === "DESIGN" ? TEAMS.DESIGN : TEAMS.VIDEO);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
