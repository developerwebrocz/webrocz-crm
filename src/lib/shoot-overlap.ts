// Do two shoots on the same date clash in time? Used when an account manager asks for a
// shoot (to warn that the slot is already booked) and when the request is saved.

const toMin = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// A shoot's time as [start, end) in minutes. No start time → unknown (null); a start with no
// (or an earlier) end time counts as one hour.
function slot(start: string, end: string): [number, number] | null {
  const s = toMin(start);
  if (s === null) return null;
  const e = toMin(end);
  return [s, e !== null && e > s ? e : s + 60];
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a = slot(aStart, aEnd), b = slot(bStart, bEnd);
  return !!a && !!b && a[0] < b[1] && b[0] < a[1];
}

// "11:00 – 13:00" / "11:00" / "time not set"
export const timeRange = (start: string, end: string) => (start ? `${start}${end ? ` – ${end}` : ""}` : "time not set");
