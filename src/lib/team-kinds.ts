// The creative teams that keep a daily count and have a team lead: the video editors
// ("Editing Count") and the designers ("Design Count"). One set of pages serves both; this
// says what differs — the role, the page and the words.
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
