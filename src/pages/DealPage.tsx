import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/store";
import { Avatar, Row, Section, Toast } from "@/components/ui";
import { CompanyPicker } from "@/components/Pickers";
import StageBar from "@/components/StageBar";
import ProductGrid from "@/components/ProductGrid";
import BxTimeline, { type TimelineEvent } from "@/components/BxTimeline";
import { RecordLink, useCloseSlider, useOpenRecord } from "@/lib/nav";
import { formatLong, formatDate } from "@/lib/dates";
import { formatPln, lineTotal } from "@/lib/money";

/*
 * Deal card in the Bitrix24 layout: title with rename pencil, stage chevrons (same stages as the
 * board), tabs Ogólne / Produkty / Historia, "Więcej" / "Produkty" / "Powtarzalny klient" panels,
 * timeline on the right.
 */
type Tab = "general" | "products" | "history";
const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };

function IconButton({ href, label, d, disabled }: { href?: string; label: string; d: string; disabled?: boolean }) {
  const cls = `flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ${disabled ? "text-gray-300" : "text-gray-600 hover:text-brand"}`;
  const svg = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
  return disabled || !href ? (
    <span className={cls} title={label}>
      {svg}
    </span>
  ) : (
    <a href={href} className={cls} title={label} aria-label={label}>
      {svg}
    </a>
  );
}

export default function DealPage({ id: idProp }: { id?: number }) {
  const params = useParams();
  const dealId = idProp ?? Number(params.id);
  const close = useCloseSlider();
  const openRecord = useOpenRecord();
  const { data, repo, companyById, contactById, productById, personName, linesOf, moveDeal, updateDeal, deleteDeal, createDeal } = useData();
  const deal = data.deals.find((d) => d.id === dealId);
  const saved = linesOf(dealId);
  const [tab, setTab] = useState<Tab>("general");
  const [editingMore, setEditingMore] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(deal?.title ?? "");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const history = useMemo(() => data.stage_history.filter((h) => h.deal_id === dealId).sort((a, b) => a.moved_at.localeCompare(b.moved_at)), [data.stage_history, dealId]);

  useEffect(() => {
    if (deal) document.title = `${deal.title} · Browar Pogórza CRM`;
  }, [deal]);

  const events = useMemo<TimelineEvent[]>(() => {
    if (!deal) return [];
    const list: TimelineEvent[] = [];
    history.forEach((h, i) => {
      const stage = stageByCode.get(h.stage_code);
      if (i === 0) {
        list.push({ key: `h${h.id}`, at: h.moved_at, title: "Deal utworzony", icon: "info", link: { to: `/deals/${deal.id}`, label: deal.title }, ownerId: h.moved_by ?? deal.owner_id });
        return;
      }
      const prev = stageByCode.get(history[i - 1].stage_code);
      const closed = stage && stage.semantic !== "open";
      list.push({
        key: `h${h.id}`,
        at: h.moved_at,
        title: closed ? "Deal zakończony" : "Zmiana etapu",
        icon: closed ? "up" : "stage",
        pills: closed ? [{ text: stage.name, tone: stage.semantic === "won" ? "won" : "lost" }] : undefined,
        arrow: closed ? undefined : [prev?.name ?? "", stage?.name ?? h.stage_code],
        ownerId: h.moved_by ?? deal.owner_id,
      });
    });
    if (history.length === 0) list.push({ key: "created", at: deal.created_at, title: "Deal utworzony", icon: "info", ownerId: deal.owner_id });
    return list;
  }, [deal, history, stageByCode]);

  if (!deal) return <div className="p-6 text-muted">Nie ma takiego dealu.</div>;

  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
  const companyContacts = data.contacts.filter((c) => c.company_id === deal.company_id);
  const previousWon = data.deals.filter((d) => d.company_id === deal.company_id && d.id !== deal.id && d.stage_code === "WON").length;
  const visibleLines = showAll ? saved : saved.slice(0, 3);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  };
  const saveTitle = () =>
    run(async () => {
      const t = title.trim() || `Deal #${deal.id}`;
      if (t !== deal.title) await updateDeal(dealId, { title: t });
      setRenaming(false);
    });
  const remove = () => {
    if (!window.confirm(`Usunąć ${deal.title}? Tej operacji nie da się cofnąć.`)) return;
    run(async () => {
      await deleteDeal(dealId);
      close();
    });
  };
  const copy = () =>
    run(async () => {
      const lines = saved.map(({ product_id, product_name, price, quantity, discount_rate, discount_sum, sort }) => ({ product_id, product_name, price, quantity, discount_rate, discount_sum, sort }));
      const created = await createDeal({ title: "", company_id: deal.company_id, contact_id: deal.contact_id, stage_code: data.stages[0].code, currency: deal.currency, begin_date: new Date().toISOString().slice(0, 10), close_date: null, closed: false, repeat_customer: deal.repeat_customer, owner_id: deal.owner_id, comment: deal.comment, source: deal.source }, lines);
      openRecord(`/deals/${created.id}`);
    });

  const tabs: [Tab, string][] = [
    ["general", "Ogólne"],
    ["products", "Produkty"],
    ["history", "Historia"],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4 text-ink overflow-x-hidden">
      <header className="flex flex-wrap items-center gap-3">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveTitle();
            }}
          >
            <input className="input text-xl w-64" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus aria-label="Nazwa dealu" />
            <button type="submit" className="btn-primary py-1.5">
              Zapisz
            </button>
            <button type="button" className="btn-ghost py-1.5" onClick={() => (setTitle(deal.title), setRenaming(false))}>
              Anuluj
            </button>
          </form>
        ) : (
          <h1 className="text-[22px] font-semibold flex items-center gap-2">
            {deal.title}
            <button type="button" className="text-gray-400 hover:text-gray-700 text-base" onClick={() => (setTitle(deal.title), setRenaming(true))} aria-label="Zmień nazwę" title="Zmień nazwę">
              ✎
            </button>
          </h1>
        )}
        <span className="text-sm text-gray-500">Domyślny lejek{deal.repeat_customer ? " (Powtarzalny deal)" : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xl font-medium tabular-nums mr-2">{formatPln(deal.amount)}</span>
          <IconButton href={company?.phone ? `tel:${company.phone}` : undefined} disabled={!company?.phone} label="Zadzwoń" d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />
          <IconButton href={company?.email ? `mailto:${company.email}` : undefined} disabled={!company?.email} label="Napisz e-mail" d="M3 6h18v12H3zM3 7l9 6 9-6" />
          <button type="button" className="btn-ghost py-1.5" onClick={copy} disabled={busy}>
            Kopiuj
          </button>
        </div>
      </header>

      <StageBar stages={data.stages} current={deal.stage_code} disabled={busy} onMove={(code) => run(() => moveDeal(dealId, code))} />

      <nav className="flex gap-1 overflow-x-auto scroll-x text-[15px]">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" className={`rounded-lg px-4 py-2 whitespace-nowrap ${tab === key ? "bg-[#e8f7fd] text-link font-medium" : "text-gray-600 hover:text-gray-900"}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "general" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start [&>*]:min-w-0">
          <div className="space-y-4 min-w-0 break-words">
            <Section title="Więcej" onEdit={() => setEditingMore((v) => !v)} editLabel={editingMore ? "gotowe" : "edytuj"}>
              <Row label="Typ dealu">Sprzedaż</Row>
              <Row label="Data rozpoczęcia">
                {editingMore ? <input type="date" className="input w-48 py-1" value={deal.begin_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { begin_date: e.target.value || null }))} /> : formatLong(deal.begin_date) || "—"}
              </Row>
              <Row label="Data zakończenia">
                {editingMore ? <input type="date" className="input w-48 py-1" value={deal.close_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { close_date: e.target.value || null }))} /> : formatLong(deal.close_date) || "—"}
              </Row>
              <Row label="Dostępny dla wszystkich">Tak</Row>
              <Row label="Osoba odpowiedzialna">
                <div className="mt-1 flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <Avatar name={personName(deal.owner_id)} size={32} />
                  <span className="text-link">{personName(deal.owner_id)}</span>
                </div>
              </Row>
              <Row label="Komentarz">
                {editingMore ? <input className="input py-1" defaultValue={deal.comment ?? ""} disabled={busy} onBlur={(e) => e.target.value !== (deal.comment ?? "") && run(() => updateDeal(dealId, { comment: e.target.value || null }))} /> : deal.comment || "—"}
              </Row>
              <Row label="Klient">
                {editingMore ? (
                  <div className="space-y-2">
                    <CompanyPicker value={deal.company_id} onChange={(cid) => run(() => updateDeal(dealId, { company_id: cid, contact_id: null }))} />
                    <select className="input py-1" value={deal.contact_id ?? ""} disabled={busy || companyContacts.length === 0} onChange={(e) => run(() => updateDeal(dealId, { contact_id: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">{companyContacts.length ? "— kontakt —" : "brak kontaktów firmy"}</option>
                      {companyContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name} {c.last_name ?? ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : company ? (
                  <div className="mt-1 rounded-lg border border-gray-200 p-3">
                    <div className="text-[11px] text-gray-500">Firma</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <RecordLink to={`/companies/${company.id}`} className="text-[16px] text-ink hover:text-link truncate min-w-0">
                        {company.name}
                      </RecordLink>
                      <span className="ml-auto flex gap-2 text-gray-400">
                        {company.phone && (
                          <a href={`tel:${company.phone}`} title={company.phone} className="hover:text-brand">
                            ☎
                          </a>
                        )}
                        {company.email && (
                          <a href={`mailto:${company.email}`} title={company.email} className="hover:text-brand">
                            ✉
                          </a>
                        )}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{[company.company_type && TYPE_LABEL[company.company_type], company.nip && `NIP ${company.nip}`].filter(Boolean).join(", ")}</div>
                    {contact && (
                      <div className="mt-2 border-t border-gray-100 pt-2 text-sm">
                        <div className="text-[11px] text-gray-500">Kontakt</div>
                        {contact.first_name} {contact.last_name ?? ""} {contact.phone && <span className="text-gray-500">· {contact.phone}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <button type="button" className="link text-sm" onClick={() => setEditingMore(true)}>
                    wybierz firmę
                  </button>
                )}
              </Row>
              <div className="pt-2 flex justify-between text-xs">
                <span />
                <button type="button" className="text-gray-400 hover:text-danger" onClick={remove}>
                  Usuń deal
                </button>
              </div>
            </Section>

            <Section title="Produkty" onEdit={() => setTab("products")}>
              <Row label="Produkty">
                {saved.length} {saved.length === 1 ? "pozycja" : saved.length < 5 ? "pozycje" : "pozycji"} na łączną kwotę {formatPln(deal.amount)}
                <button type="button" className="ml-3 link text-sm" onClick={() => setTab("products")}>
                  edytuj
                </button>
              </Row>
              {saved.length > 0 && (
                <div className="rounded-lg bg-panel-2 p-2 space-y-1">
                  {visibleLines.map((l) => {
                    const product = l.product_id ? productById.get(l.product_id) : null;
                    const img = repo.imageUrl(product?.image_path ?? null);
                    return (
                      <div key={l.id} className="flex items-center gap-3 px-2 py-1.5">
                        {img ? <img src={img} alt="" className="h-8 w-8 rounded object-cover bg-white" loading="lazy" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-white text-gray-300">▣</span>}
                        <div className="min-w-0 flex-1">
                          {product ? (
                            <RecordLink to={`/products/${product.id}`} className="block truncate text-link hover:underline">
                              {l.product_name}
                            </RecordLink>
                          ) : (
                            <div className="truncate text-gray-700" title="Pozycja spoza katalogu">
                              {l.product_name}
                            </div>
                          )}
                          <div className="text-[12px] text-gray-600">{formatPln(lineTotal(l))}</div>
                        </div>
                      </div>
                    );
                  })}
                  {saved.length > 3 && (
                    <button type="button" className="px-2 py-1 text-sm text-gray-500 hover:text-link" onClick={() => setShowAll((v) => !v)}>
                      {showAll ? "Pokaż mniej" : `Pokaż jeszcze ${saved.length - 3}`}
                    </button>
                  )}
                </div>
              )}
            </Section>

            <Section title="Powtarzalny klient">
              <Row label="Powtórzenie">{deal.repeat_customer ? `Tak, klient miał już ${previousWon} wygranych dealów` : "Nie, pierwszy deal tego klienta"}</Row>
              <Row label="Utworzono">{formatLong(deal.created_at)}</Row>
            </Section>
          </div>
          <BxTimeline entity="deal" entityId={dealId} events={events} taskHint="Zaplanuj kolejny krok w dealu, żeby nie zapomnieć o kliencie" />
        </div>
      )}

      {tab === "products" && <ProductGrid dealId={dealId} lines={saved} onError={setError} />}

      {tab === "history" && (
        <section className="rounded-xl bg-white shadow-sm divide-y divide-gray-100">
          {[...history].reverse().map((h) => {
            const s = stageByCode.get(h.stage_code);
            return (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-40 text-gray-500">{new Date(h.moved_at).toLocaleString("pl-PL")}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: s?.color }}>
                  {s?.name ?? h.stage_code}
                </span>
                {h.moved_by && <span className="ml-auto text-gray-400">{personName(h.moved_by)}</span>}
              </div>
            );
          })}
          <div className="px-4 py-2 text-xs text-gray-400">ostatnia zmiana {formatDate(deal.updated_at)}</div>
        </section>
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
