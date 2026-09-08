import { useEffect, type ReactNode } from "react";
import { formatPln } from "@/lib/money";

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatPln(value)}</span>;
}

export function Modal({ title, open, onClose, children, wide = false }: { title: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`card w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sticky top-0 bg-panel z-10">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>
        <div className="p-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-8 text-center text-muted text-sm">{children}</div>;
}

export function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <span className={`inline-flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-panel-2 text-[11px] font-semibold text-gray-200`} title={name}>
      {initials || "?"}
    </span>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">{message}</div>;
}

export function SearchInput({ value, onChange, placeholder = "Szukaj" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />;
}

export const matches = (needle: string, ...hay: (string | null | undefined)[]): boolean => {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return hay.some((h) => (h ?? "").toLowerCase().includes(q));
};
