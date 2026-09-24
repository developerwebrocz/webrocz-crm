// Reporting periods + the time-factor model.
import { FACTORS } from "./domain";

export type PeriodKey = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "custom";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "lastWeek", label: "Last week" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

// "Now" for all reporting. In DEMO mode we pin it to the seeded month (Aug 2026) so every
// dashboard shows populated data; set the DEMO_DATE env var to that pin. In real production,
// leave DEMO_DATE unset and this returns the live date so your own current data shows.
export function now() {
  const demo = process.env.DEMO_DATE;
  return demo ? new Date(demo) : new Date();
}

export function resolvePeriod(key: PeriodKey, from?: string, to?: string) {
  const n = now();
  const y = n.getFullYear();
  const m = n.getMonth();
  const dow = (n.getDay() + 6) % 7; // 0 = Monday
  let start: Date;
  let end: Date;
  switch (key) {
    case "today":
      start = new Date(y, m, n.getDate());
      end = new Date(y, m, n.getDate(), 23, 59, 59);
      break;
    case "yesterday":
      start = new Date(y, m, n.getDate() - 1);
      end = new Date(y, m, n.getDate() - 1, 23, 59, 59);
      break;
    case "week":
      start = new Date(y, m, n.getDate() - dow);
      end = new Date(y, m, n.getDate() - dow + 6, 23, 59, 59);
      break;
    case "lastWeek":
      start = new Date(y, m, n.getDate() - dow - 7);
      end = new Date(y, m, n.getDate() - dow - 1, 23, 59, 59);
      break;
    case "lastMonth":
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
      break;
    case "custom":
      start = from ? new Date(from) : new Date(y, m, 1);
      end = to ? new Date(to + "T23:59:59") : new Date(y, m + 1, 0, 23, 59, 59);
      break;
    case "month":
    default:
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
  }
  return { start, end, factor: FACTORS[key] ?? 1 };
}

export function monthLabel(d = now()) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function monthProgressLabel(d = now()) {
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `Day ${d.getDate()} of ${total}`;
}

// e.g. "84% of month gone"
export function monthGonePct(d = now()) {
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((d.getDate() / total) * 100);
}
