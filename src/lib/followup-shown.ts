// A "next follow-up" date counts only when someone chose it.
//
// The older follow-up forms pre-filled the "Next follow-up" box with today's date, so just
// saving a note also saved "next follow-up = today" — a date nobody picked. Such a date is the
// same day as the note it was saved with, and is treated as not set: it is not shown as the next
// follow-up and is not a reminder. (The forms no longer pre-fill the date, and a date that is
// picked is always a later day.)

type Note = { date?: string; time?: string; next?: string; via?: string };
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

// A client's date: not chosen when it came with a follow-up logged that same day on the old
// form (the website-renewals one, which pre-filled it). A follow-up logged in the Phone / WhatsApp
// popup or in Payment Reminders carries how it was made (`via`) — its date was picked by hand,
// also when it is the same day.
export function chosenClientFollowup(date: string | null | undefined, notes: Note[]): string {
  if (!isDate(date)) return "";
  if (notes.some((n) => n.next === date && !!n.via)) return date;
  return notes.some((n) => n.next === date && day(n.date) === date) ? "" : date;
}
