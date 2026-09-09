import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/store";
import { Row, Section, Toast } from "@/components/ui";
import DealGrid from "@/components/DealGrid";
import { ProductForm } from "./Products";
import { formatLong } from "@/lib/dates";
import { formatPln } from "@/lib/money";

/*
 * Product card as a slider (Bitrix catalog item): photo, price and unit, group, sales figures,
 * and the list of deals the product appears in. Opened from a deal's product section, the
 * editable product grid or the catalog tiles.
 */
type Tab = "general" | "deals";

export default function ProductPage({ id: idProp }: { id?: number }) {
  const params = useParams();
  const productId = idProp ?? Number(params.id);
  const { data, repo, updateProduct, uploadProductImage } = useData();
  const product = data.products.find((p) => p.id === productId);
  const [tab, setTab] = useState<Tab>("general");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => data.deal_lines.filter((l) => l.product_id === productId), [data.deal_lines, productId]);
  const dealIds = useMemo(() => new Set(lines.map((l) => l.deal_id)), [lines]);
  const deals = useMemo(() => data.deals.filter((d) => dealIds.has(d.id)).sort((a, b) => b.id - a.id), [data.deals, dealIds]);
  const sold = lines.reduce((s, l) => s + l.quantity, 0);
  const revenue = lines.reduce((s, l) => s + l.price * l.quantity * (1 - (l.discount_rate || 0) / 100) - (l.discount_sum || 0), 0);
  const year = new Date().getFullYear();
  const soldYear = lines.filter((l) => data.deals.find((d) => d.id === l.deal_id)?.created_at.startsWith(String(year))).reduce((s, l) => s + l.quantity, 0);
  const lastDeal = deals[0];

  useEffect(() => {
    if (product) document.title = `${product.name} · Browar Pogórza CRM`;
  }, [product]);

  if (!product) return <div className="p-6 text-muted">Nie ma takiego produktu.</div>;
  const img = repo.imageUrl(product.image_path);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4 text-ink overflow-x-hidden">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold flex items-center gap-2">
          {product.name}
          <button type="button" className="text-gray-400 hover:text-gray-700 text-base" onClick={() => setEditing(true)} aria-label="Edytuj produkt" title="Edytuj">
            ✎
          </button>
        </h1>
        {!product.active && <span className="pill bg-gray-200 text-gray-600">nieaktywny</span>}
        <span className="ml-auto text-xl font-medium tabular-nums">{formatPln(product.price)}</span>
        <button type="button" className="btn-ghost py-1.5" onClick={() => setEditing(true)}>
          Edytuj
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto scroll-x text-[15px]">
        {(
          [
            ["general", "Ogólne"],
            ["deals", `Deale (${deals.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" className={`rounded-lg px-4 py-2 whitespace-nowrap ${tab === key ? "bg-[#e8f7fd] text-link font-medium" : "text-gray-600 hover:text-gray-900"}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "general" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start [&>*]:min-w-0">
          <Section title="O produkcie" onEdit={() => setEditing(true)}>
            <div className="py-2">
              {img ? (
                <img src={img} alt={product.name} className="h-56 w-56 rounded-xl object-cover bg-white shadow-sm" />
              ) : (
                <label className="flex h-56 w-56 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:text-gray-600">
                  + dodaj zdjęcie
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProductImage(product.id, e.target.files[0]).catch((err) => setError(String(err)))} />
                </label>
              )}
            </div>
            <Row label="Cena">
              <span className="text-[28px] font-light">{formatPln(product.price)}</span>
              <span className="ml-2 text-sm text-gray-500">za {product.unit}</span>
            </Row>
            <Row label="Grupa">{product.group_name ?? "—"}</Row>
            <Row label="Jednostka">{product.unit}</Row>
            <Row label="Aktywny">{product.active ? "Tak" : "Nie"}</Row>
            {product.slug && <Row label="Kod">{product.slug}</Row>}
            <Row label="Utworzono">{formatLong(product.created_at)}</Row>
          </Section>
          <div className="space-y-4">
            <Section title="Sprzedaż">
              <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-4">
                {[
                  [`Sprzedano ${year}`, `${soldYear} ${product.unit}`],
                  ["Sprzedano łącznie", `${sold} ${product.unit}`],
                  ["Przychód łącznie", formatPln(revenue)],
                  ["Dealów", String(deals.length)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-panel-2 p-3">
                    <div className="text-[11px] text-gray-500">{label}</div>
                    <div className="text-lg font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <Row label="Ostatni deal">{lastDeal ? `${lastDeal.title} · ${formatLong(lastDeal.begin_date ?? lastDeal.created_at)}` : "—"}</Row>
            </Section>
            <Section title="Ostatnie deale" onEdit={() => setTab("deals")} editLabel="wszystkie">
              <DealGrid deals={deals.slice(0, 5)} compact onError={setError} />
            </Section>
          </div>
        </div>
      )}

      {tab === "deals" && <DealGrid deals={deals} compact onError={setError} />}

      {editing && (
        <ProductForm
          open
          onClose={() => setEditing(false)}
          initial={product}
          onSubmit={(v) => updateProduct(product.id, v)}
          onImage={(file) => uploadProductImage(product.id, file)}
        />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
