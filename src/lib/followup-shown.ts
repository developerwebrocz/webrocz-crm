// A "next follow-up" date counts only when someone chose it.
//
// The older follow-up forms pre-filled the "Next follow-up" box with today's date, so just
// saving a note also saved "next follow-up = today" — a date nobody picked. Such a date is the
// same day as the note it was saved with, and is treated as not set: it is not shown as the next
// follow-up and is not a reminder. (The forms no longer pre-fill the date, and a date that is
// picked is always a later day.)

type Note = { date?: string; next?: string };
const day = (v: string | undefined) => (v ?? "").slice(0, 10);
const isDate = (v: string | null | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

export function parseNotes(json: string | null | undefined): Note[] {
  try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

// An invoice's own date: not chosen when a follow-up note of that invoice was written that same day.
export function chosenInvoiceFollowup(date: string | null | undefined, notes: Note[]): string {
  if (!isDate(date)) return "";
  return notes.some((n) => day(n.date) === date) ? "" : date;
}

// A client's date: not chosen when it came with a follow-up logged that same day.
export function chosenClientFollowup(date: string | null | undefined, notes: Note[]): string {
  if (!isDate(date)) return "";
  return notes.some((n) => n.next === date && day(n.date) === date) ? "" : date;
}
