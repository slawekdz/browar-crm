import { useMemo, useState } from "react";
import type { Company, Product } from "@/types";
import { useData } from "@/store";
import { Modal, SearchInput, matches } from "./ui";
import { formatPln } from "@/lib/money";

/** Searchable company select: renders as a button that opens a list. */
export function CompanyPicker({ value, onChange, allowNone = true }: { value: number | null; onChange: (id: number | null, company: Company | null) => void; allowNone?: boolean }) {
  const { data, companyById } = useData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => data.companies.filter((c) => matches(q, c.name, c.nip, c.email)).sort((a, b) => a.name.localeCompare(b.name, "pl")).slice(0, 80), [data.companies, q]);
  const current = value ? companyById.get(value) : null;
  return (
    <>
      <button type="button" className="input text-left truncate" onClick={() => setOpen(true)}>
        {current?.name ?? <span className="text-gray-500">Wybierz firmę…</span>}
      </button>
      <Modal title="Firma" open={open} onClose={() => setOpen(false)}>
        <SearchInput value={q} onChange={setQ} placeholder="Nazwa, NIP, e-mail" />
        <ul className="mt-3 max-h-[60vh] overflow-y-auto divide-y divide-line">
          {allowNone && (
            <li>
              <button type="button" className="w-full px-2 py-2 text-left text-sm text-muted hover:bg-panel-2" onClick={() => (onChange(null, null), setOpen(false))}>
                bez firmy
              </button>
            </li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" className="w-full px-2 py-2 text-left text-sm hover:bg-panel-2" onClick={() => (onChange(c.id, c), setOpen(false))}>
                <div>{c.name}</div>
                <div className="text-xs text-muted">{[c.nip && `NIP ${c.nip}`, c.email].filter(Boolean).join(" · ")}</div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-2 py-4 text-sm text-muted">Brak wyników</li>}
        </ul>
      </Modal>
    </>
  );
}

export function ProductPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (product: Product) => void }) {
  const { data, repo } = useData();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("");
  const groups = useMemo(() => [...new Set(data.products.map((p) => p.group_name).filter(Boolean))] as string[], [data.products]);
  const list = useMemo(
    () => data.products.filter((p) => p.active && (!group || p.group_name === group) && matches(q, p.name)).sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [data.products, q, group],
  );
  return (
    <Modal title="Dodaj produkt" open={open} onClose={onClose}>
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Nazwa produktu" />
        <select className="input w-40" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Grupa">
          <option value="">Wszystkie</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <ul className="mt-3 max-h-[60vh] overflow-y-auto divide-y divide-line">
        {list.map((p) => {
          const img = repo.imageUrl(p.image_path);
          return (
            <li key={p.id}>
              <button type="button" className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-panel-2" onClick={() => onPick(p)}>
                {img ? <img src={img} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" /> : <span className="h-10 w-10 rounded bg-panel-2" />}
                <span className="flex-1">
                  <span className="block">{p.name}</span>
                  <span className="text-xs text-muted">{p.group_name}</span>
                </span>
                <span className="tabular-nums">{formatPln(p.price)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
