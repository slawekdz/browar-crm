import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/types";
import { useData } from "@/store";
import { RecordLink, useOpenRecord } from "@/lib/nav";
import { Avatar } from "./ui";
import StageMini from "./StageMini";
import { formatPln } from "@/lib/money";
import { formatNumeric } from "@/lib/dates";

/*
 * Bitrix deals grid: sticky sortable header, checkbox selection with a bulk action bar, row menu
 * (Otwórz / Edytuj / Kopiuj / Usuń), paging footer, horizontal scroll with edge buttons.
 * Used by the Deals list view and the company "Deale" tab.
 */

type SortKey = "title" | "client" | "amount" | "created" | "stage";
const PAGE_SIZES = [20, 50, 100];

export default function DealGrid({ deals, compact = false, onError }: { deals: Deal[]; compact?: boolean; onError: (m: string) => void }) {
  const { data, companyById, contactById, personName, linesOf, deleteDeal, moveDeal, createDeal } = useData();
  const openRecord = useOpenRecord();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [pageSize, setPageSize] = useState(compact ? 20 : 50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<number | null>(null);
  const [bulkStage, setBulkStage] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const clientOf = (d: Deal) => ({ contact: d.contact_id ? contactById.get(d.contact_id) : null, company: d.company_id ? companyById.get(d.company_id) : null });
  const sorted = useMemo(() => {
    const stageSort = new Map(data.stages.map((s) => [s.code, s.sort]));
    const key = (d: Deal): string | number => {
      if (sort.key === "title") return d.title.toLowerCase();
      if (sort.key === "amount") return d.amount;
      if (sort.key === "stage") return stageSort.get(d.stage_code) ?? 0;
      if (sort.key === "client") return (clientOf(d).company?.name ?? "").toLowerCase();
      return d.created_at;
    };
    return [...deals].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, sort, data.stages]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [deals.length, pageSize, sort]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => (el.removeEventListener("scroll", update), window.removeEventListener("resize", update));
  }, [rows.length]);
  useEffect(() => {
    if (menu === null) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "created" ? -1 : 1 }));
  const allOnPage = rows.length > 0 && rows.every((d) => selected.has(d.id));
  const toggleAll = () => setSelected((s) => (allOnPage ? new Set([...s].filter((id) => !rows.some((r) => r.id === id))) : new Set([...s, ...rows.map((r) => r.id)])));
  const toggle = (id: number) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Błąd");
    }
  };
  const bulkDelete = () => {
    if (!window.confirm(`Usunąć ${selected.size} dealów? Tej operacji nie da się cofnąć.`)) return;
    run(async () => {
      for (const id of selected) await deleteDeal(id);
      setSelected(new Set());
    });
  };
  const bulkMove = (code: string) => {
    if (!code) return;
    run(async () => {
      for (const id of selected) await moveDeal(id, code);
      setSelected(new Set());
      setBulkStage("");
    });
  };
  const copyDeal = (d: Deal) =>
    run(async () => {
      const lines = linesOf(d.id).map(({ product_id, product_name, price, quantity, discount_rate, discount_sum, sort }) => ({ product_id, product_name, price, quantity, discount_rate, discount_sum, sort }));
      const copy = await createDeal({ title: "", company_id: d.company_id, contact_id: d.contact_id, stage_code: data.stages[0].code, currency: d.currency, begin_date: new Date().toISOString().slice(0, 10), close_date: null, closed: false, repeat_customer: d.repeat_customer, owner_id: d.owner_id, comment: d.comment, source: d.source }, lines);
      openRecord(`/deals/${copy.id}`);
    });
  const removeOne = (d: Deal) => window.confirm(`Usunąć ${d.title}?`) && run(() => deleteDeal(d.id));

  const th = (label: string, key?: SortKey, className = "") => (
    <th className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap ${className}`}>
      {key ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-gray-800" onClick={() => toggleSort(key)}>
          {label}
          {sort.key === key && <span aria-hidden>{sort.dir === 1 ? "▴" : "▾"}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="rounded-xl bg-white shadow-sm text-sm">
      <div className="relative">
        {edges.left && (
          <button type="button" className="absolute left-1 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-gray-800/60 text-white" onClick={() => scroller.current?.scrollBy({ left: -400, behavior: "smooth" })} aria-label="Przewiń w lewo">
            ‹
          </button>
        )}
        {edges.right && (
          <button type="button" className="absolute right-1 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-gray-800/60 text-white" onClick={() => scroller.current?.scrollBy({ left: 400, behavior: "smooth" })} aria-label="Przewiń w prawo">
            ›
          </button>
        )}
        <div ref={scroller} className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-[5] bg-white border-b border-line">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPage && rows.some((r) => selected.has(r.id));
                    }}
                    onChange={toggleAll}
                    aria-label="Zaznacz wszystkie"
                  />
                </th>
                <th className="w-8" />
                {th("Deal", "title")}
                {th("Etap", "stage", "w-44")}
                {th("Klient", "client")}
                {th("Kwota", "amount", "text-right")}
                {th("Odpowiedzialny")}
                {th("Utworzono", "created")}
                {!compact && th("Produkty")}
                {!compact && th("NIP")}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const { contact, company } = clientOf(d);
                const products = linesOf(d.id).map((l) => l.product_name).join(", ");
                const isSel = selected.has(d.id);
                return (
                  <tr key={d.id} className={`border-b border-line/70 align-top ${isSel ? "bg-[#eef8e6]" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(d.id)} aria-label={`Zaznacz ${d.title}`} />
                    </td>
                    <td className="relative px-1 py-2.5">
                      <button type="button" className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Menu ${d.title}`} onClick={(e) => (e.stopPropagation(), setMenu(menu === d.id ? null : d.id))}>
                        ≡
                      </button>
                      {menu === d.id && (
                        <div className="absolute left-6 top-8 z-20 w-40 rounded-lg bg-white py-1 shadow-xl border border-line fade-in" role="menu">
                          {[
                            ["Otwórz", () => openRecord(`/deals/${d.id}`)],
                            ["Edytuj", () => openRecord(`/deals/${d.id}`)],
                            ["Kopiuj", () => copyDeal(d)],
                            ["Usuń", () => removeOne(d)],
                          ].map(([label, fn]) => (
                            <button key={label as string} type="button" role="menuitem" className={`block w-full px-3 py-1.5 text-left hover:bg-gray-50 ${label === "Usuń" ? "text-danger" : ""}`} onClick={fn as () => void}>
                              {label as string}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <RecordLink to={`/deals/${d.id}`} className="link font-medium">
                        {d.title}
                      </RecordLink>
                      <div className="text-[11px] text-gray-500">Sprzedaż{d.repeat_customer ? " (Powtarzalny deal)" : ""}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StageMini stages={data.stages} current={d.stage_code} />
                    </td>
                    <td className="px-3 py-2.5">
                      {contact && (
                        <div className="text-link">
                          {contact.first_name} {contact.last_name ?? ""}
                        </div>
                      )}
                      {company && (
                        <RecordLink to={`/companies/${company.id}`} className={contact ? "text-[12px] text-gray-500 hover:underline" : "link"}>
                          {company.name}
                        </RecordLink>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{formatPln(d.amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={personName(d.owner_id)} size={22} />
                        {personName(d.owner_id)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{formatNumeric(d.created_at)}</td>
                    {!compact && <td className="px-3 py-2.5 text-gray-600 max-w-64 truncate">{products}</td>}
                    {!compact && <td className="px-3 py-2.5 text-gray-600">{company?.nip ?? ""}</td>}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Brak dealów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-2 text-[11px] uppercase tracking-wide text-gray-500">
        <span>
          Zaznaczono: {selected.size} / {sorted.length}
        </span>
        <span>Razem: {sorted.length}</span>
        <span className="flex items-center gap-1">
          Strony:
          <button type="button" className="px-1 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Poprzednia strona">
            ‹
          </button>
          {page} / {pages}
          <button type="button" className="px-1 disabled:opacity-30" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Następna strona">
            ›
          </button>
        </span>
        <label className="flex items-center gap-1">
          Rekordy:
          <select className="rounded border border-line bg-white px-1 py-0.5 text-xs normal-case" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rekordów na stronę">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={`flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-[11px] uppercase tracking-wide ${selected.size ? "text-gray-700" : "text-gray-400"}`}>
        <button type="button" className="disabled:opacity-40 hover:text-danger" disabled={!selected.size} onClick={bulkDelete}>
          ✕ Usuń
        </button>
        <select className="rounded border border-line bg-white px-1 py-0.5 text-xs normal-case disabled:opacity-40" disabled={!selected.size} value={bulkStage} onChange={(e) => (setBulkStage(e.target.value), bulkMove(e.target.value))} aria-label="Wybierz akcję">
          <option value="">Wybierz akcję: przenieś na etap</option>
          {data.stages.map((s) => (
            <option key={s.code} value={s.code}>
              → {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={selected.size > 0 && selected.size === sorted.length} onChange={(e) => setSelected(e.target.checked ? new Set(sorted.map((d) => d.id)) : new Set())} /> Dla wszystkich
        </label>
        {selected.size > 0 && <span className="ml-auto">Zaznaczono: {selected.size}</span>}
      </div>
    </div>
  );
}
