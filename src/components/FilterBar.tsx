import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal, Stage } from "@/types";
import { useData } from "@/store";
import { CURRENT_USER_ID } from "@/lib/db";

/*
 * Bitrix "Filter and search" pill: a preset chip (Deals in progress / Closed deals / My deals),
 * free-text search, and a popup with presets on the left and fields on the right. The state is
 * kept in localStorage so Kanban and List share it and it survives navigation, like Bitrix.
 */

export type Preset = "open" | "closed" | "mine" | null;
export interface DealFilter {
  preset: Preset;
  q: string;
  title: string;
  owner: number | null;
  minAmount: string;
  maxAmount: string;
  stage: string;
  closeFrom: string;
  closeTo: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_FILTER: DealFilter = { preset: "open", q: "", title: "", owner: null, minAmount: "", maxAmount: "", stage: "", closeFrom: "", closeTo: "", createdFrom: "", createdTo: "" };
const KEY = "browar-crm-deal-filter";
export const PRESET_LABEL: Record<Exclude<Preset, null>, string> = { open: "Deale w toku", closed: "Zamknięte deale", mine: "Moje deale" };

export const loadFilter = (): DealFilter => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_FILTER, ...(JSON.parse(raw) as Partial<DealFilter>) } : EMPTY_FILTER;
  } catch {
    return EMPTY_FILTER;
  }
};
export const saveFilter = (f: DealFilter): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
};

export const isDefaultFields = (f: DealFilter): boolean => !f.title && f.owner === null && !f.minAmount && !f.maxAmount && !f.stage && !f.closeFrom && !f.closeTo && !f.createdFrom && !f.createdTo;

export function applyFilter(deals: Deal[], f: DealFilter, stages: Stage[], companyName: (id: number | null) => string, companyNip: (id: number | null) => string, ownerName: (id: number | null) => string): Deal[] {
  const semantic = new Map(stages.map((s) => [s.code, s.semantic]));
  const q = f.q.trim().toLowerCase();
  const min = f.minAmount ? parseFloat(f.minAmount.replace(",", ".")) : null;
  const max = f.maxAmount ? parseFloat(f.maxAmount.replace(",", ".")) : null;
  return deals.filter((d) => {
    const sem = semantic.get(d.stage_code) ?? "open";
    if (f.preset === "open" && sem !== "open") return false;
    if (f.preset === "closed" && sem === "open") return false;
    if (f.preset === "mine" && d.owner_id !== CURRENT_USER_ID) return false;
    if (f.title && !d.title.toLowerCase().includes(f.title.toLowerCase())) return false;
    if (f.owner !== null && d.owner_id !== f.owner) return false;
    if (min !== null && d.amount < min) return false;
    if (max !== null && d.amount > max) return false;
    if (f.stage && d.stage_code !== f.stage) return false;
    if (f.closeFrom && (d.close_date ?? "") < f.closeFrom) return false;
    if (f.closeTo && (d.close_date ?? "9999") > f.closeTo) return false;
    if (f.createdFrom && d.created_at.slice(0, 10) < f.createdFrom) return false;
    if (f.createdTo && d.created_at.slice(0, 10) > f.createdTo) return false;
    if (q) {
      const hay = [d.title, `#${d.id}`, companyName(d.company_id), companyNip(d.company_id), ownerName(d.owner_id), d.comment ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export default function FilterBar({ value, onChange }: { value: DealFilter; onChange: (f: DealFilter) => void }) {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DealFilter>(value);
  const box = useRef<HTMLDivElement>(null);
  const people = useMemo(() => data.people.filter((p) => p.active || data.deals.some((d) => d.owner_id === p.id)), [data.people, data.deals]);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => (window.removeEventListener("mousedown", onDown), window.removeEventListener("keydown", onKey));
  }, [open]);

  const set = (patch: Partial<DealFilter>) => setDraft((d) => ({ ...d, ...patch }));
  const choosePreset = (p: Preset) => {
    onChange({ ...EMPTY_FILTER, q: value.q, preset: p });
    setOpen(false);
  };
  const search = () => {
    onChange(draft);
    setOpen(false);
  };
  const reset = () => {
    onChange({ ...EMPTY_FILTER, preset: null, q: "" });
    setOpen(false);
  };
  const custom = !isDefaultFields(value);

  return (
    <div ref={box} className="relative flex-1 min-w-56">
      <div className="flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-white backdrop-blur focus-within:bg-white/25">
        {value.preset && (
          <span className="flex items-center gap-1 rounded-md bg-white/25 px-2 py-0.5 text-xs whitespace-nowrap">
            {PRESET_LABEL[value.preset]}
            <button type="button" aria-label="Usuń filtr" className="hover:text-danger" onClick={() => onChange({ ...value, preset: null })}>
              ×
            </button>
          </span>
        )}
        {custom && (
          <span className="flex items-center gap-1 rounded-md bg-white/25 px-2 py-0.5 text-xs whitespace-nowrap">
            filtr
            <button type="button" aria-label="Usuń pola filtra" className="hover:text-danger" onClick={() => onChange({ ...EMPTY_FILTER, preset: value.preset, q: value.q })}>
              ×
            </button>
          </span>
        )}
        <input
          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm placeholder:text-white/70 focus:outline-none"
          placeholder={value.preset || custom ? "szukaj" : "Filtruj i szukaj"}
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          onFocus={() => setOpen(true)}
          aria-label="Filtruj i szukaj"
        />
        <button type="button" className="px-1 text-white/80 hover:text-white" aria-label="Filtr" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4a7 7 0 105.3 11.6L21 20" strokeLinecap="round" />
          </svg>
        </button>
        {(value.q || value.preset || custom) && (
          <button type="button" className="px-1 text-white/80 hover:text-white" aria-label="Wyczyść" onClick={reset}>
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 flex w-full max-w-[640px] overflow-hidden rounded-xl bg-white text-ink shadow-2xl fade-in" role="dialog" aria-label="Filtr">
          <div className="w-40 shrink-0 bg-gray-50 border-r border-line p-2 text-sm">
            {(["closed", "open", "mine"] as const).map((p) => (
              <button key={p} type="button" className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-white ${value.preset === p ? "bg-white font-medium text-link" : "text-gray-700"}`} onClick={() => choosePreset(p)}>
                {PRESET_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0 p-3 space-y-2 text-sm">
            <label className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <span className="text-gray-500">Nazwa</span>
              <input className="input py-1" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <span className="text-gray-500">Odpowiedzialny</span>
              <select className="input py-1" value={draft.owner ?? ""} onChange={(e) => set({ owner: e.target.value ? Number(e.target.value) : null })}>
                <option value="">dowolny</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
              <span className="text-gray-500">Kwota</span>
              <input className="input py-1" placeholder="od" inputMode="decimal" value={draft.minAmount} onChange={(e) => set({ minAmount: e.target.value })} aria-label="Kwota od" />
              <input className="input py-1" placeholder="do" inputMode="decimal" value={draft.maxAmount} onChange={(e) => set({ maxAmount: e.target.value })} aria-label="Kwota do" />
            </div>
            <label className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <span className="text-gray-500">Etap</span>
              <select className="input py-1" value={draft.stage} onChange={(e) => set({ stage: e.target.value })}>
                <option value="">dowolny</option>
                {data.stages.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
              <span className="text-gray-500">Data zakończenia</span>
              <input className="input py-1" type="date" value={draft.closeFrom} onChange={(e) => set({ closeFrom: e.target.value })} aria-label="Zakończenie od" />
              <input className="input py-1" type="date" value={draft.closeTo} onChange={(e) => set({ closeTo: e.target.value })} aria-label="Zakończenie do" />
            </div>
            <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
              <span className="text-gray-500">Utworzono</span>
              <input className="input py-1" type="date" value={draft.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} aria-label="Utworzono od" />
              <input className="input py-1" type="date" value={draft.createdTo} onChange={(e) => set({ createdTo: e.target.value })} aria-label="Utworzono do" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button type="button" className="btn-primary" onClick={search}>
                Szukaj
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                Resetuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
