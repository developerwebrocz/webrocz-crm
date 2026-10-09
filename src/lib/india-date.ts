// "Today" for the accounts team is today in India, wherever the code runs. The server runs on
// UTC and `new Date().toISOString()` is UTC too, so between midnight and 5:30 am India time a
// plain ISO date is still yesterday — an invoice or payment saved then got the wrong date.

// YYYY-MM-DD in India (UTC+5:30).
export const todayIST = (at: Date = new Date()): string => at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
