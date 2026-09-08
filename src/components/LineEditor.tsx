import { useState } from "react";
import type { NewLine, Product } from "@/types";
import { ProductPicker } from "./Pickers";
import { Money } from "./ui";
import { dealAmount, lineTotal } from "@/lib/money";

export const lineFromProduct = (p: Product): NewLine => ({ product_id: p.id, product_name: p.name, price: p.price, quantity: 1, discount_rate: 0, discount_sum: 0, sort: 0 });

const toNumber = (value: string): number => {
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function LineEditor({ lines, onChange, readOnly = false }: { lines: NewLine[]; onChange: (lines: NewLine[]) => void; readOnly?: boolean }) {
  const [picking, setPicking] = useState(false);
  const update = (index: number, patch: Partial<NewLine>) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index));
  const add = (p: Product) => {
    const existing = lines.findIndex((l) => l.product_id === p.id);
    if (existing >= 0) update(existing, { quantity: lines[existing].quantity + 1 });
    else onChange([...lines, lineFromProduct(p)]);
    setPicking(false);
  };
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_5rem_6rem_4.5rem_6rem_2rem] gap-2 px-1 text-xs uppercase tracking-wide text-muted">
        <span>Produkt</span>
        <span>Ilość</span>
        <span>Cena</span>
        <span>Rabat %</span>
        <span className="text-right">Razem</span>
        <span />
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_6rem_4.5rem_6rem_2rem] gap-2 items-center card p-2 sm:p-1 sm:bg-transparent sm:border-0">
          <div className="col-span-2 sm:col-span-1 text-sm">
            {readOnly ? line.product_name : <input className="input" value={line.product_name} onChange={(e) => update(index, { product_name: e.target.value })} aria-label="Nazwa" />}
          </div>
          <input className="input" type="number" inputMode="decimal" min={0} step="1" value={line.quantity} disabled={readOnly} onChange={(e) => update(index, { quantity: toNumber(e.target.value) })} aria-label="Ilość" />
          <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={line.price} disabled={readOnly} onChange={(e) => update(index, { price: toNumber(e.target.value) })} aria-label="Cena" />
          <input className="input" type="number" inputMode="decimal" min={0} max={100} step="1" value={line.discount_rate} disabled={readOnly} onChange={(e) => update(index, { discount_rate: toNumber(e.target.value) })} aria-label="Rabat %" />
          <Money value={lineTotal(line)} className="text-right text-sm font-medium" />
          {!readOnly && (
            <button type="button" className="text-muted hover:text-red-400 text-right" onClick={() => remove(index)} aria-label="Usuń pozycję">
              ✕
            </button>
          )}
        </div>
      ))}
      {lines.length === 0 && <div className="text-sm text-muted px-1">Brak pozycji</div>}
      <div className="flex items-center justify-between pt-1">
        {readOnly ? <span /> : (
          <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
            + Produkt
          </button>
        )}
        <div className="text-sm">
          Razem: <Money value={dealAmount(lines)} className="text-base font-semibold" />
        </div>
      </div>
      <ProductPicker open={picking} onClose={() => setPicking(false)} onPick={add} />
    </div>
  );
}
