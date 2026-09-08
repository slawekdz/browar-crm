import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { NewLine } from "@/types";
import { useData } from "@/store";
import { Toast } from "@/components/ui";
import { CompanyPicker } from "@/components/Pickers";
import LineEditor from "@/components/LineEditor";
import StageBar from "@/components/StageBar";
import BxTimeline, { type TimelineEvent } from "@/components/BxTimeline";
import { formatDate } from "@/lib/dates";
import { formatPln, lineTotal } from "@/lib/money";

/*
 * Deal card in the Bitrix24 layout: stage chevrons on top (same stages as the board), tabs,
 * "Więcej" / "Produkty" / "Powtarzalny deal" panels on the left, timeline on the right.
 */

type Tab = "general" | "products" | "history";
const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`py-2 ${className}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-[15px] text-gray-900">{children}</div>
    </div>
  );
}

function Panel({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white shadow-sm p-5">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</h2>
        {onEdit && (
          <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={onEdit}>
            edytuj
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function DealPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const navigate = useNavigate();
  const { data, repo, companyById, contactById, productById, personName, linesOf, moveDeal, updateDeal, setLines, deleteDeal } = useData();
  const deal = data.deals.find((d) => d.id === dealId);
  const saved = linesOf(dealId);
  const [tab, setTab] = useState<Tab>("general");
  const [lines, setLinesState] = useState<NewLine[]>(saved);
  const [editingLines, setEditingLines] = useState(false);
  const [editingMore, setEditingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const history = useMemo(() => data.stage_history.filter((h) => h.deal_id === dealId).sort((a, b) => a.moved_at.localeCompare(b.moved_at)), [data.stage_history, dealId]);

  useEffect(() => {
    if (!editingLines) setLinesState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.deal_lines, editingLines]);

  const events = useMemo<TimelineEvent[]>(() => {
    if (!deal) return [];
    const list: TimelineEvent[] = [];
    history.forEach((h, i) => {
      const stage = stageByCode.get(h.stage_code);
      if (i === 0) {
        list.push({ key: `h${h.id}`, at: h.moved_at, title: "Deal utworzony", icon: "info", pills: [{ text: stage?.name ?? h.stage_code, tone: "grey" }], ownerId: h.moved_by ?? deal.owner_id });
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

  if (!deal)
    return (
      <div className="p-6 text-muted">
        Nie ma takiego dealu. <Link to="/" className="text-sky-300">Wróć</Link>
      </div>
    );

  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
  const stage = stageByCode.get(deal.stage_code);
  const companyContacts = data.contacts.filter((c) => c.company_id === deal.company_id);
  const previousWon = data.deals.filter((d) => d.company_id === deal.company_id && d.id !== deal.id && d.stage_code === "WON").length;

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

  const remove = () => {
    if (!window.confirm(`Usunąć ${deal.title}? Tej operacji nie da się cofnąć.`)) return;
    run(async () => {
      await deleteDeal(dealId);
      navigate("/");
    });
  };

  const productsPanel = (
    <Panel title="Produkty" onEdit={editingLines ? undefined : () => setEditingLines(true)}>
      {editingLines ? (
        <div className="space-y-3">
          <LineEditor lines={lines} onChange={setLinesState} />
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" onClick={() => (setLinesState(saved), setEditingLines(false))}>
              Anuluj
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#2fc6f6] px-3 py-1.5 text-sm font-medium text-white"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setLines(dealId, lines);
                  setEditingLines(false);
                })
              }
            >
              Zapisz
            </button>
          </div>
        </div>
      ) : (
        <>
          <Field label="Produkty">
            {saved.length} {saved.length === 1 ? "pozycja" : saved.length < 5 ? "pozycje" : "pozycji"} za {formatPln(deal.amount)}
            <button type="button" className="ml-3 text-sm text-[#0b66c3] hover:underline" onClick={() => setEditingLines(true)}>
              edytuj
            </button>
          </Field>
          <ul className="space-y-2">
            {saved.map((l) => {
              const product = l.product_id ? productById.get(l.product_id) : null;
              const img = repo.imageUrl(product?.image_path ?? null);
              return (
                <li key={l.id} className="flex items-center gap-3 rounded-lg bg-[#f5f7f8] p-3">
                  {img ? <img src={img} alt="" className="h-12 w-12 rounded-full object-cover bg-white" loading="lazy" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-300">▣</span>}
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] text-[#0b66c3] truncate">{l.product_name}</div>
                    <div className="text-sm text-gray-600">
                      {l.quantity} szt. × {formatPln(l.price)}
                      {l.discount_rate ? ` − ${l.discount_rate}%` : ""}
                    </div>
                  </div>
                  <div className="text-[15px] text-gray-900 tabular-nums">{formatPln(lineTotal(l))}</div>
                </li>
              );
            })}
            {saved.length === 0 && <li className="text-sm text-gray-500">Brak pozycji</li>}
          </ul>
        </>
      )}
    </Panel>
  );

  return (
    <div className="min-h-full bg-[#eef2f6] text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-5 space-y-4">
        <Link to="/" className="text-xs text-gray-500">
          ← Deale
        </Link>
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900">{deal.title}</h1>
          <span className="text-sm text-gray-500">
            Domyślny lejek{deal.repeat_customer ? " (Powtarzalny deal)" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-xl font-medium text-gray-900 tabular-nums">{formatPln(deal.amount)}</span>
            {company?.phone && (
              <a href={`tel:${company.phone}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm" title="Zadzwoń">
                ☎
              </a>
            )}
            {company?.email && (
              <a href={`mailto:${company.email}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm" title="Napisz e-mail">
                ✉
              </a>
            )}
          </div>
        </header>

        <StageBar stages={data.stages} current={deal.stage_code} disabled={busy} onMove={(code) => run(() => moveDeal(dealId, code))} />

        <nav className="flex gap-1 overflow-x-auto scroll-x text-[15px]">
          {(
            [
              ["general", "Ogólne"],
              ["products", "Produkty"],
              ["history", "Historia"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button key={key} type="button" className={`rounded-lg px-4 py-2 whitespace-nowrap ${tab === key ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600 hover:text-gray-900"}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "general" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
            <div className="space-y-4 min-w-0 break-words">
              <Panel title="Więcej" onEdit={() => setEditingMore((v) => !v)}>
                <Field label="Typ dealu">Sprzedaż</Field>
                <Field label="Etap">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: stage?.color }}>
                    {stage?.name}
                  </span>
                </Field>
                <Field label="Data rozpoczęcia">
                  {editingMore ? (
                    <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={deal.begin_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { begin_date: e.target.value || null }))} />
                  ) : (
                    formatDate(deal.begin_date) || "—"
                  )}
                </Field>
                <Field label="Data zakończenia">
                  {editingMore ? (
                    <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" value={deal.close_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { close_date: e.target.value || null }))} />
                  ) : (
                    formatDate(deal.close_date) || "—"
                  )}
                </Field>
                <Field label="Osoba odpowiedzialna">
                  <div className="mt-1 flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                      {personName(deal.owner_id)
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="text-[#0b66c3]">{personName(deal.owner_id)}</span>
                  </div>
                </Field>
                <Field label="Komentarz">
                  {editingMore ? (
                    <input className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" defaultValue={deal.comment ?? ""} disabled={busy} onBlur={(e) => e.target.value !== (deal.comment ?? "") && run(() => updateDeal(dealId, { comment: e.target.value || null }))} />
                  ) : (
                    deal.comment || "—"
                  )}
                </Field>
                <Field label="Klient">
                  {editingMore ? (
                    <div className="space-y-2">
                      <CompanyPicker value={deal.company_id} onChange={(cid) => run(() => updateDeal(dealId, { company_id: cid, contact_id: null }))} />
                      <select className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white" value={deal.contact_id ?? ""} disabled={busy || companyContacts.length === 0} onChange={(e) => run(() => updateDeal(dealId, { contact_id: e.target.value ? Number(e.target.value) : null }))}>
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
                      <div className="text-xs text-gray-500">Firma</div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Link to={`/companies/${company.id}`} className="text-[17px] text-gray-900 hover:text-[#0b66c3] truncate min-w-0">
                          {company.name}
                        </Link>
                        <span className="ml-auto flex gap-1 text-gray-400">
                          {company.phone && (
                            <a href={`tel:${company.phone}`} title={company.phone}>
                              ☎
                            </a>
                          )}
                          {company.email && (
                            <a href={`mailto:${company.email}`} title={company.email}>
                              ✉
                            </a>
                          )}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {[company.company_type && TYPE_LABEL[company.company_type], company.nip && `NIP ${company.nip}`].filter(Boolean).join(", ")}
                      </div>
                      {contact && (
                        <div className="mt-2 border-t border-gray-100 pt-2 text-sm">
                          <div className="text-xs text-gray-500">Kontakt</div>
                          {contact.first_name} {contact.last_name ?? ""} {contact.phone && <span className="text-gray-500">· {contact.phone}</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button type="button" className="text-[#0b66c3] text-sm" onClick={() => setEditingMore(true)}>
                      wybierz firmę
                    </button>
                  )}
                </Field>
                <div className="pt-2 text-right">
                  <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={remove}>
                    Usuń deal
                  </button>
                </div>
              </Panel>
              {productsPanel}
              <Panel title="Powtarzalny deal">
                <Field label="Powtórzenie">{deal.repeat_customer ? `Tak — klient miał już ${previousWon} wygranych dealów` : "Nie — pierwszy deal tego klienta"}</Field>
                <Field label="Utworzono">{formatDate(deal.created_at)}</Field>
              </Panel>
            </div>
            <BxTimeline entity="deal" entityId={dealId} events={events} taskHint="Zaplanuj kolejny krok w dealu, żeby nie zapomnieć o kliencie" />
          </div>
        )}

        {tab === "products" && productsPanel}

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
          </section>
        )}
      </div>
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
