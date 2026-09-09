const time = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
const longNoYear = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });
const longYear = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });
const shortNoYear = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const shortYear = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const numeric = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const parse = (iso: string): Date => (iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso));
const sameDay = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isThisYear = (d: Date): boolean => d.getFullYear() === new Date().getFullYear();

export const formatTime = (iso: string | null | undefined): string => (iso ? time.format(parse(iso)) : "");
/** "8 września 2026 r." (year dropped in the current year: "8 września"). Record fields, kanban cards. */
export const formatLong = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = parse(iso);
  return isThisYear(d) ? longNoYear.format(d) : `${longYear.format(d)} r.`;
};
/** Kanban card date: "dzisiaj, 08:29", "wczoraj, 17:10", "2 września", "23 września 2025 r." */
export const formatRelativeDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = parse(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dateOnly = iso.length === 10; // begin_date carries no time, so "wczoraj, 00:00" would be misleading
  if (sameDay(d, now)) return dateOnly ? "dzisiaj" : `dzisiaj, ${time.format(d)}`;
  if (sameDay(d, yesterday)) return dateOnly ? "wczoraj" : `wczoraj, ${time.format(d)}`;
  return formatLong(iso);
};
/** Card footer: "Dzisiaj 08:29", "2 wrz", "17 paź 2025" */
export const formatShortDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = parse(iso);
  if (sameDay(d, new Date())) return `Dzisiaj ${time.format(d)}`;
  return isThisYear(d) ? shortNoYear.format(d) : shortYear.format(d);
};
/** List cells: "14.04.2026" or "dzisiaj" */
export const formatNumeric = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = parse(iso);
  return sameDay(d, new Date()) ? "dzisiaj" : numeric.format(d);
};
export const formatDate = (iso: string | null | undefined): string => (iso ? shortYear.format(parse(iso)) : "");
export const formatDateTime = (iso: string | null | undefined): string => (iso ? dateTimeFmt.format(parse(iso)) : "");
export const today = (): string => new Date().toISOString().slice(0, 10);
export const nowIso = (): string => new Date().toISOString();
export const isPast = (iso: string | null | undefined): boolean => !!iso && parse(iso).getTime() < Date.now();
