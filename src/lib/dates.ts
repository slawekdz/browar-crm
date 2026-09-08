const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string | null | undefined): string => (iso ? dateFmt.format(new Date(iso)) : "");
export const formatDateTime = (iso: string | null | undefined): string => (iso ? dateTimeFmt.format(new Date(iso)) : "");
export const today = (): string => new Date().toISOString().slice(0, 10);
export const nowIso = (): string => new Date().toISOString();
