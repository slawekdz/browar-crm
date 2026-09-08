import { useMemo, useState, type FormEvent } from "react";
import type { NewProduct, Product } from "@/types";
import { useData } from "@/store";
import { Field, Modal, Money, Toast, matches } from "@/components/ui";

const GROUPS = ["Piwo butelka", "Piwo PET/KEG", "Kawa", "Gadżety", "Usługi"];
const emptyProduct = (): NewProduct => ({ name: "", slug: null, price: 0, unit: "szt.", active: true, sort: 500, group_name: GROUPS[0], image_path: null });

function ProductForm({ open, onClose, initial, onSubmit, onImage }: { open: boolean; onClose: () => void; initial: NewProduct | Product; onSubmit: (v: NewProduct) => Promise<void>; onImage?: (file: File) => Promise<void> }) {
  const { repo } = useData();
  const [values, setValues] = useState<NewProduct>({ ...emptyProduct(), ...initial });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  };
  const img = repo.imageUrl(values.image_path);
  return (
    <Modal title={"id" in initial ? "Edytuj produkt" : "Nowy produkt"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-3">
          {img ? <img src={img} alt="" className="h-24 w-24 rounded-lg object-cover" /> : <div className="h-24 w-24 rounded-lg bg-panel-2" />}
          <div className="flex-1 space-y-3">
            <Field label="Nazwa">
              <input className="input" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required autoFocus />
            </Field>
            {onImage && (
              <label className="btn-ghost cursor-pointer">
                Zmień zdjęcie
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0]).catch((err) => setError(String(err)))} />
              </label>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cena (PLN)">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={values.price} onChange={(e) => setValues((v) => ({ ...v, price: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="Jednostka">
            <input className="input" value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} />
          </Field>
          <Field label="Grupa">
            <select className="input" value={values.group_name ?? ""} onChange={(e) => setValues((v) => ({ ...v, group_name: e.target.value }))}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Aktywny">
            <select className="input" value={values.active ? "1" : "0"} onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === "1" }))}>
              <option value="1">tak</option>
              <option value="0">nie</option>
            </select>
          </Field>
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Zapisz
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const { data, repo, createProduct, updateProduct, uploadProductImage } = useData();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sold = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of data.deal_lines) if (l.product_id) map.set(l.product_id, (map.get(l.product_id) ?? 0) + l.quantity);
    return map;
  }, [data.deal_lines]);

  const list = useMemo(
    () => data.products.filter((p) => (showInactive || p.active) && (!group || p.group_name === group) && matches(q, p.name)).sort((a, b) => GROUPS.indexOf(a.group_name ?? "") - GROUPS.indexOf(b.group_name ?? "") || a.name.localeCompare(b.name, "pl")),
    [data.products, q, group, showInactive],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2 text-white space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold mr-1">Produkty</h1>
          <button type="button" className="btn-success py-1.5" onClick={() => setEditing("new")}>
            + Utwórz
          </button>
          <div className="flex-1 min-w-56 flex items-center rounded-lg bg-white/15 px-3 py-1 backdrop-blur focus-within:bg-white/25">
            <input className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-white/70 focus:outline-none" placeholder="Filtruj i szukaj" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nazwa" />
          </div>
          <select className="rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur [&>option]:text-ink" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Grupa">
            <option value="">Wszystkie grupy</option>
            {GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-white/90">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> nieaktywne
          </label>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((p) => {
            const img = repo.imageUrl(p.image_path);
            return (
              <button key={p.id} type="button" className={`card overflow-hidden text-left hover:shadow-md ${p.active ? "" : "opacity-50"}`} onClick={() => setEditing(p)}>
                {img ? <img src={img} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" /> : <div className="aspect-square w-full bg-panel-2 flex items-center justify-center text-muted text-xs">brak zdjęcia</div>}
                <div className="p-3">
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-xs text-muted">{p.group_name}</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <Money value={p.price} className="font-semibold" />
                    <span className="text-xs text-muted">{sold.get(p.id) ? `${sold.get(p.id)} sprzedanych` : ""}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {editing && (
        <ProductForm
          open
          onClose={() => setEditing(null)}
          initial={editing === "new" ? emptyProduct() : editing}
          onSubmit={async (v) => {
            if (editing === "new") await createProduct(v);
            else await updateProduct(editing.id, v);
          }}
          onImage={editing === "new" ? undefined : (file) => uploadProductImage(editing.id, file)}
        />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
