import { useEffect, useMemo, useRef, useState } from "react";
import type { NewLine, Product } from "@/types";
import { useData } from "@/store";
import { ProductPicker } from "./Pickers";
import { RecordLink } from "@/lib/nav";
import { dealAmount, discountTotal, formatCents, formatPln, lineTotal } from "@/lib/money";

/*
 * Bitrix "Products" tab of a deal: always-editable grid with "Dodaj produkt" (blank row with
 * catalog autocomplete) and "Wybierz produkt" (catalog picker), row handle + number, thumbnail,
 * price with "zł", quantity with "szt.", line amount, and the totals block. Saves on every change
 * (debounced) so it behaves like Bitrix's autosaving grid.
 */
const toNumber = (value: string): number => {
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function ProductGrid({ dealId, lines: saved, onError }: { dealId: number; lines: NewLine[]; onError: (m: string) => void }) {
  const { data, repo, productById, setLines } = useData();
  const [lines, setLocal] = useState<NewLine[]>(saved);
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestFor, setSuggestFor] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!dirty) setLocal(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const persist = (next: NewLine[]) => {
    setLocal(next);
    setDirty(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await setLines(dealId, next.filter((l) => l.product_name.trim()));
        setDirty(false);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Błąd zapisu pozycji");
      } finally {
        setSaving(false);
      }
    }, 600);
  };
  const update = (index: number, patch: Partial<NewLine>) => persist(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const remove = (index: number) => persist(lines.filter((_, i) => i !== index));
  const addBlank = () => persist([...lines, { product_id: null, product_name: "", price: 0, quantity: 1, discount_rate: 0, discount_sum: 0, sort: lines.length * 10 }]);
  const pick = (p: Product) => {
    const existing = lines.findIndex((l) => l.product_id === p.id);
    if (existing >= 0) update(existing, { quantity: lines[existing].quantity + 1 });
    else persist([...lines, { product_id: p.id, product_name: p.name, price: p.price, quantity: 1, discount_rate: 0, discount_sum: 0, sort: lines.length * 10 }]);
    setPicking(false);
  };
  const applyProduct = (index: number, p: Product) => {
    update(index, { product_id: p.id, product_name: p.name, price: p.price });
    setSuggestFor(null);
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const suggestions = useMemo(() => {
    if (suggestFor === null) return [];
    const q = (lines[suggestFor]?.product_name ?? "").trim().toLowerCase();
    return data.products.filter((p) => p.active && (!q || p.name.toLowerCase().includes(q))).slice(0, 8);
  }, [suggestFor, lines, data.products]);

  const gross = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = discountTotal(lines);
  const total = dealAmount(lines);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={addBlank}>
          Dodaj produkt
        </button>
        <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
          Wybierz produkt
        </button>
        <span className="ml-auto text-xs text-gray-500">{saving ? "Zapisywanie…" : dirty ? "Niezapisane zmiany" : "Zapisano"}</span>
      </div>
      <div className="rounded-xl bg-white shadow-sm overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-gray-500">
              <th className="w-10 px-2 py-2" />
              <th className="px-2 py-2 text-left">Produkt</th>
              <th className="w-14 px-2 py-2" />
              <th className="w-32 px-2 py-2 text-left">Cena</th>
              <th className="w-28 px-2 py-2 text-left">Ilość</th>
              <th className="w-24 px-2 py-2 text-left">Rabat %</th>
              <th className="w-32 px-2 py-2 text-right">Kwota</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const product = line.product_id ? productById.get(line.product_id) : null;
              const img = repo.imageUrl(product?.image_path ?? null);
              return (
                <tr key={index} className="group border-b border-line/70 align-middle hover:bg-gray-50">
                  <td className="px-2 py-2 text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="flex flex-col leading-none opacity-0 group-hover:opacity-100">
                        <button type="button" className="text-[10px] hover:text-gray-700" onClick={() => move(index, -1)} aria-label="W górę">
                          ▲
                        </button>
                        <button type="button" className="text-[10px] hover:text-gray-700" onClick={() => move(index, 1)} aria-label="W dół">
                          ▼
                        </button>
                      </span>
                      {index + 1}.
                    </span>
                  </td>
                  <td className="relative px-2 py-2">
                    <input
                      className="input py-1.5"
                      value={line.product_name}
                      placeholder="Nazwa produktu"
                      aria-label={`Produkt ${index + 1}`}
                      onFocus={() => setSuggestFor(index)}
                      onBlur={() => window.setTimeout(() => setSuggestFor((s) => (s === index ? null : s)), 150)}
                      onChange={(e) => update(index, { product_name: e.target.value, product_id: null })}
                    />
                    {suggestFor === index && suggestions.length > 0 && (
                      <ul className="absolute left-2 right-2 top-full z-20 max-h-56 overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
                        {suggestions.map((p) => (
                          <li key={p.id}>
                            <button type="button" className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-50" onMouseDown={(e) => e.preventDefault()} onClick={() => applyProduct(index, p)}>
                              <span>{p.name}</span>
                              <span className="text-gray-500 tabular-nums">{formatPln(p.price)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {product ? (
                      <RecordLink to={`/products/${product.id}`} title={`Otwórz ${product.name}`} aria-label={`Otwórz ${product.name}`} className="block h-9 w-9 overflow-hidden rounded hover:ring-2 hover:ring-brand">
                        {img ? <img src={img} alt="" className="h-9 w-9 object-cover" loading="lazy" /> : <span className="flex h-9 w-9 items-center justify-center border border-dashed border-gray-300 text-gray-300">▣</span>}
                      </RecordLink>
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-gray-300 text-gray-300" title="Pozycja spoza katalogu">
                        ▣
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1">
                      <input className="input py-1.5" type="number" inputMode="decimal" min={0} step="0.01" value={line.price} aria-label="Cena" onChange={(e) => update(index, { price: toNumber(e.target.value) })} />
                      <span className="text-gray-500">zł</span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1">
                      <input className="input py-1.5" type="number" inputMode="decimal" min={0} step="1" value={line.quantity} aria-label="Ilość" onChange={(e) => update(index, { quantity: toNumber(e.target.value) })} />
                      <span className="text-gray-500">szt.</span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input className="input py-1.5" type="number" inputMode="decimal" min={0} max={100} step="1" value={line.discount_rate} aria-label="Rabat %" onChange={(e) => update(index, { discount_rate: toNumber(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatCents(lineTotal(line))} zł</td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" className="text-gray-300 hover:text-danger" onClick={() => remove(index)} aria-label="Usuń pozycję">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Brak pozycji. Dodaj produkt albo wybierz z katalogu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex justify-end px-4 py-3">
          <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-1 text-sm">
            <dt className="text-gray-500">Razem bez rabatów i podatków</dt>
            <dd className="text-right tabular-nums">{formatPln(gross)}</dd>
            <dt className="text-gray-500">Koszt dostawy</dt>
            <dd className="text-right tabular-nums">0 zł</dd>
            <dt className="text-gray-500">Kwota rabatu</dt>
            <dd className="text-right tabular-nums text-success">{formatPln(discount)}</dd>
            <dt className="text-gray-500">Razem przed opodatkowaniem</dt>
            <dd className="text-right tabular-nums">{formatPln(total)}</dd>
            <dt className="text-gray-500">Podatek razem</dt>
            <dd className="text-right tabular-nums">0 zł</dd>
            <dt className="border-t border-line pt-1 font-semibold">Kwota całkowita</dt>
            <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums">{formatPln(total)}</dd>
          </dl>
        </div>
      </div>
      <ProductPicker open={picking} onClose={() => setPicking(false)} onPick={pick} />
    </div>
  );
}
