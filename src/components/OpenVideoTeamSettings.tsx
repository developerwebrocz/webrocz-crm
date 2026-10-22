"use client";

// Editing Count (Super Admin): opens the folded section and scrolls to "Video team settings"
// — the team lead and the editors who go on shoots (Studiox Shoot shooter / "My Shoots").
export default function OpenVideoTeamSettings() {
  const open = () => {
    const form = document.getElementById("video-team-settings");
    const details = form?.closest("details");
    if (details) details.open = true;
    requestAnimationFrame(() => form?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return <button type="button" onClick={open} className="btn btn-ghost text-[13px]">Video team settings · who goes on shoots</button>;
}
