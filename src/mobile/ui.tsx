import { useEffect, type ReactNode } from "react";

/* Shared bits of the Bitrix24-mobile look: line icons, bottom sheet, action menu, card label rows. */

const PATHS: Record<string, string> = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  chat: "M4 5h16v10H8l-4 4z",
  timeline: "M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10",
  funnel: "M4 5h16l-6 8v6l-4-2v-4z",
  search: "M11 4a7 7 0 105.3 11.6L21 20",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  plus: "M12 5v14M5 12h14",
  down: "M6 9l6 6 6-6",
  pencil: "M4 20l4-1 10-10-3-3L5 16zM13 7l3 3",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  check: "M5 12l4 4L19 6",
  close: "M6 6l12 12M18 6L6 18",
  deal: "M3 8l4-3 5 3 5-3 4 3v9l-4 3-5-3-5 3-4-3z",
  building: "M4 21V5l8-3v19M12 21h8V9l-8-3M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  tasks: "M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9",
  menu: "M4 6h16M4 12h16M4 18h16",
  back: "M15 6l-6 6 6 6",
  calendar: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
};

export function MIcon({ name, className = "h-5 w-5", strokeWidth = 1.9 }: { name: keyof typeof PATHS | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

/** Bottom sheet, the way the Bitrix app opens pickers and menus. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="bxm fixed inset-0 z-[90] flex items-end bg-black/60 fade-in" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title ?? "Menu"} style={{ background: "rgba(0,0,0,.6)" }}>
      <div className="w-full rounded-t-2xl p-3 pb-6 shadow-2xl slider-up" style={{ background: "var(--m-card)" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
        {title && <div className="px-2 pb-2 text-base font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function SheetItem({ icon, children, onClick, danger = false }: { icon?: string; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[17px] hover:bg-white/5 ${danger ? "text-red-400" : ""}`} onClick={onClick}>
      <span className="flex-1">{children}</span>
      {icon && <MIcon name={icon} className="h-5 w-5 opacity-70" />}
    </button>
  );
}

export function LabelValue({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="m-label">{label}</div>
      <div className="mt-0.5 text-[17px]">{children}</div>
    </div>
  );
}

/** Round icon rail on the right side of list cards: timeline counter + phone / mail / chat. */
export function IconRail({ count, phone, email, onTimeline }: { count: number; phone: string | null | undefined; email: string | null | undefined; onTimeline: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" className="relative flex flex-col items-center" onClick={onTimeline}>
        <span className="m-round h-12 w-12 m-round-on">
          <MIcon name="timeline" />
        </span>
        <span className="absolute -right-1 -top-1 rounded-full bg-[#3a4150] px-1.5 text-[11px] font-semibold text-white">{count}</span>
        <span className="mt-1 text-[11px] m-muted">Oś czasu</span>
      </button>
      <div className="flex flex-col items-center gap-1 rounded-full py-2" style={{ background: "var(--m-card-2)" }}>
        <a href={phone ? `tel:${phone}` : undefined} className={`flex h-9 w-9 items-center justify-center rounded-full ${phone ? "m-round-on" : "m-muted opacity-50"}`} aria-label="Zadzwoń" onClick={(e) => e.stopPropagation()}>
          <MIcon name="phone" className="h-4.5 w-4.5" />
        </a>
        <a href={email ? `mailto:${email}` : undefined} className={`flex h-9 w-9 items-center justify-center rounded-full ${email ? "m-round-on" : "m-muted opacity-50"}`} aria-label="Napisz e-mail" onClick={(e) => e.stopPropagation()}>
          <MIcon name="mail" className="h-4.5 w-4.5" />
        </a>
        <span className="flex h-9 w-9 items-center justify-center rounded-full m-muted opacity-50" aria-label="Czat">
          <MIcon name="chat" className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  );
}

export function Fab({ onClick, label = "Utwórz" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="fixed bottom-24 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: "var(--m-fab)" }} onClick={onClick} aria-label={label}>
      <MIcon name="plus" className="h-7 w-7" strokeWidth={2.2} />
    </button>
  );
}

export const mInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

export function MAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#c98a7a] text-[12px] font-semibold text-white" style={{ width: size, height: size }} title={name}>
      {mInitials(name) || "?"}
    </span>
  );
}
