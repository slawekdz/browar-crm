import { useEffect, useMemo, useState } from "react";
import type { NewLine, Product } from "@/types";
import { useData } from "@/store";
import { useOpenRecord } from "@/lib/nav";
import { dealAmount, formatCents, formatPln, lineTotal } from "@/lib/money";
import { MIcon, Sheet } from "./ui";

/*
 * Bitrix24 mobile "Produkty" tab of a deal: numbered cards with thumbnail, name, price input,
 * quantity stepper, discount, amount, trash; footer with item count and totals; "Zapisz" in the
 * header when there are unsaved changes (the parent renders the header, so it gets `dirty`/`save`).
 */
const toNumber = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function MobileDealProducts({ dealId, saved, onDirty }: { dealId: number; saved: NewLine[]; onDirty: (dirty: boolean, save: (() => Promise<void>) | null) => void }) {
  const { data, repo, productById, setLines } = useData();
  const openRecord = useOpenRecord();
  const [lines, setLocal] = useState<NewLine[]>(saved);
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);

  useEffect(() => {
    if (!dirty) setLocal(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  useEffect(() => {
    onDirty(dirty, dirty ? async () => {
      await setLines(dealId, lines.filter((l) => l.product_name.trim()));
      setDirty(false);
    } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, lines]);

  const change = (next: NewLine[]) => {
    setLocal(next);
    setDirty(true);
  };
  const update = (i: number, patch: Partial<NewLine>) => change(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => change(lines.filter((_, idx) => idx !== i));
  const pick = (p: Product) => {
    const idx = lines.findIndex((l) => l.product_id === p.id);
    if (idx >= 0) update(idx, { quantity: lines[idx].quantity + 1 });
    else change([...lines, { product_id: p.id, product_name: p.name, price: p.price, quantity: 1, discount_rate: 0, discount_sum: 0, sort: lines.length * 10 }]);
    setPicking(false);
    setQ("");
  };
  const candidates = useMemo(() => data.products.filter((p) => p.active && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, "pl")), [data.products, q]);
  const total = dealAmount(lines);

  return (
    <div className="space-y-3 px-3 pt-3 pb-32">
      {lines.map((line, i) => {
        const product = line.product_id ? productById.get(line.product_id) : null;
        const img = repo.imageUrl(product?.image_path ?? null);
        return (
          <article key={i} className="m-card relative px-3 pb-3 pt-4">
            <span className="absolute -left-0 -top-0 rounded-br-lg rounded-tl-[14px] px-2 py-0.5 text-[12px] font-semibold" style={{ background: "var(--m-card-2)" }}>
              {i + 1}
            </span>
            <div className="flex gap-3">
              <button type="button" className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--m-card-2)" }} onClick={() => product && openRecord(`/products/${product.id}`)} aria-label={product ? `Otwórz ${product.name}` : "Pozycja spoza katalogu"}>
                {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <MIcon name="box" className="h-8 w-8 m-muted" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <input className="w-full bg-transparent text-[19px] font-medium focus:outline-none" value={line.product_name} placeholder="Nazwa produktu" aria-label={`Produkt ${i + 1}`} onChange={(e) => update(i, { product_name: e.target.value, product_id: null })} />
                  <button type="button" className="p-1 m-muted" onClick={() => setMenuFor(i)} aria-label="Menu pozycji">
                    <MIcon name="more" className="h-5 w-5" strokeWidth={3} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1.25fr] gap-3">
                  <label className="relative block">
                    <span className="absolute -top-2 left-3 rounded px-1 text-[12px] m-muted" style={{ background: "var(--m-card)" }}>
                      Cena, zł
                    </span>
                    <input className="m-input py-3" type="number" inputMode="decimal" min={0} step="0.1" value={line.price} aria-label="Cena" onChange={(e) => update(i, { price: toNumber(e.target.value) })} />
                  </label>
                  <div className="relative flex items-center gap-1">
                    <span className="absolute -top-2 right-3 z-10 rounded px-1 text-[12px] m-muted" style={{ background: "var(--m-card)" }}>
                      szt.
                    </span>
                    <button type="button" className="m-round h-10 w-10 shrink-0 text-xl" onClick={() => update(i, { quantity: Math.max(0, line.quantity - 1) })} aria-label="Mniej">
                      −
                    </button>
                    <input className="m-input min-w-0 px-1 py-3 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" inputMode="numeric" min={0} step="1" value={line.quantity} aria-label="Ilość" onChange={(e) => update(i, { quantity: toNumber(e.target.value) })} />
                    <button type="button" className="m-round h-10 w-10 shrink-0 text-xl" onClick={() => update(i, { quantity: line.quantity + 1 })} aria-label="Więcej">
                      +
                    </button>
                  </div>
                  <label className="relative block">
                    <span className="absolute -top-2 left-3 rounded px-1 text-[12px] m-muted" style={{ background: "var(--m-card)" }}>
                      Rabat
                    </span>
                    <input className="m-input py-3 pr-8" type="number" inputMode="decimal" min={0} max={100} step="1" value={line.discount_rate} aria-label="Rabat %" onChange={(e) => update(i, { discount_rate: toNumber(e.target.value) })} />
                    <span className="absolute right-3 top-3 text-[15px] m-muted">%</span>
                  </label>
                  <div className="relative">
                    <span className="absolute -top-2 right-3 rounded px-1 text-[12px] m-muted" style={{ background: "var(--m-card)" }}>
                      Kwota, zł
                    </span>
                    <div className="m-input py-3 text-right text-[19px] tabular-nums">{formatCents(lineTotal(line))}</div>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" className="mt-2 p-1 m-muted" onClick={() => remove(i)} aria-label="Usuń pozycję">
              <MIcon name="trash" />
            </button>
          </article>
        );
      })}
      <div className="m-card flex items-center justify-between px-4 py-4">
        <span className="text-[19px] m-muted">Pozycje: {lines.length}</span>
        <span className="text-right">
          <span className="block text-[22px]">
            <span className="m-muted">Łącznie: </span>
            <span className="font-semibold tabular-nums">{formatPln(total)}</span>
          </span>
          <span className="block text-[13px] m-muted">Suma podatku: 0 zł</span>
        </span>
      </div>

      <button type="button" className="m-fab-pos fixed right-4 z-40 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: "var(--m-fab)" }} onClick={() => setPicking(true)} aria-label="Dodaj produkt">
        <MIcon name="plus" className="h-7 w-7" strokeWidth={2.2} />
      </button>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Dodaj produkt">
        <input className="m-input mb-2" placeholder="Szukaj w katalogu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nazwa produktu" autoFocus />
        <div className="max-h-[50vh] overflow-y-auto">
          {candidates.map((p) => (
            <button key={p.id} type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[17px] hover:bg-white/5" onClick={() => pick(p)}>
              <span>{p.name}</span>
              <span className="m-muted tabular-nums">{formatPln(p.price)}</span>
            </button>
          ))}
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-[17px] m-link" onClick={() => (change([...lines, { product_id: null, product_name: q || "", price: 0, quantity: 1, discount_rate: 0, discount_sum: 0, sort: lines.length * 10 }]), setPicking(false), setQ(""))}>
            <MIcon name="plus" /> Pozycja spoza katalogu{q ? `: „${q}"` : ""}
          </button>
        </div>
      </Sheet>

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)}>
        {menuFor !== null && (
          <>
            {lines[menuFor]?.product_id && (
              <button type="button" className="flex w-full items-center rounded-xl px-3 py-3 text-left text-[17px]" onClick={() => (openRecord(`/products/${lines[menuFor].product_id}`), setMenuFor(null))}>
                Otwórz produkt
              </button>
            )}
            <button type="button" className="flex w-full items-center rounded-xl px-3 py-3 text-left text-[17px] text-red-400" onClick={() => (remove(menuFor), setMenuFor(null))}>
              Usuń pozycję
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
