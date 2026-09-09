import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/store";
import { Row, Section, Toast } from "@/components/ui";
import { CompanyForm } from "./Companies";
import { ContactForm, emptyContact } from "./Contacts";
import DealForm from "@/components/DealForm";
import DealGrid from "@/components/DealGrid";
import BxTimeline, { type TimelineEvent } from "@/components/BxTimeline";
import { useCloseSlider } from "@/lib/nav";
import { formatLong, formatDateTime } from "@/lib/dates";
import { formatPln } from "@/lib/money";
import { matches } from "@/components/ui";
import { companyEvents } from "@/lib/events";

/*
 * Company card in the Bitrix24 layout: title with pencil, tabs Ogólne / Deale / Kontakty / Historia,
 * "O firmie" panel on the left, timeline on the right; the Deale tab reuses the deals grid.
 */
type Tab = "general" | "deals" | "contacts" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "Ogólne" },
  { key: "deals", label: "Deale" },
  { key: "contacts", label: "Kontakty" },
  { key: "history", label: "Historia" },
];
const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };

export default function CompanyPage({ id: idProp }: { id?: number }) {
  const params = useParams();
  const companyId = idProp ?? Number(params.id);
  const close = useCloseSlider();
  const { data, updateCompany, deleteCompany, createContact, updateContact, personName } = useData();
  const company = data.companies.find((c) => c.id === companyId);
  const [tab, setTab] = useState<Tab>("general");
  const [editing, setEditing] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [dealQuery, setDealQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const deals = useMemo(() => data.deals.filter((d) => d.company_id === companyId).sort((a, b) => b.id - a.id), [data.deals, companyId]);
  const contacts = data.contacts.filter((c) => c.company_id === companyId);
  const year = new Date().getFullYear();
  const wonAll = deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);
  const wonYear = deals.filter((d) => d.stage_code === "WON" && (d.close_date ?? d.created_at).startsWith(String(year))).reduce((s, d) => s + d.amount, 0);

  useEffect(() => {
    if (company) document.title = `${company.name} · Browar Pogórza CRM`;
  }, [company]);

  const events = useMemo<TimelineEvent[]>(() => (company ? companyEvents(data, company, stageByCode) : []), [data, company, stageByCode]);

  if (!company) return <div className="p-6 text-muted">Nie ma takiej firmy.</div>;

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    }
  };
  const remove = () => {
    if (!window.confirm(`Usunąć firmę ${company.name}?`)) return;
    run(async () => {
      await deleteCompany(companyId);
      close();
    });
  };
  const filteredDeals = deals.filter((d) => matches(dealQuery, d.title, `#${d.id}`, d.comment));

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4 text-ink overflow-x-hidden">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 mr-auto">
          <h1 className="text-[22px] font-semibold flex items-center gap-2 flex-wrap">
            <span>{company.name}</span>
            <button type="button" className="text-gray-400 hover:text-gray-700 text-base" onClick={() => setEditing(true)} aria-label="Edytuj firmę" title="Edytuj">
              ✎
            </button>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ${company.phone ? "text-gray-600" : "text-gray-300"}`} title={company.phone ?? "Brak telefonu"}>
            {company.phone ? <a href={`tel:${company.phone}`} aria-label="Zadzwoń">☎</a> : "☎"}
          </span>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ${company.email ? "text-gray-600" : "text-gray-300"}`} title={company.email ?? "Brak e-maila"}>
            {company.email ? <a href={`mailto:${company.email}`} aria-label="Napisz e-mail">✉</a> : "✉"}
          </span>
          <button type="button" className="btn-primary" onClick={() => setAddingDeal(true)}>
            + Deal
          </button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto scroll-x text-[15px]">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`rounded-lg px-4 py-2 whitespace-nowrap ${tab === t.key ? "bg-[#e8f7fd] text-link font-medium" : "text-gray-600 hover:text-gray-900"}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "deals" && ` (${deals.length})`}
            {t.key === "contacts" && ` (${contacts.length})`}
          </button>
        ))}
      </nav>

      {tab === "general" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start [&>*]:min-w-0">
          <Section title="O firmie" onEdit={() => setEditing(true)}>
            <Row label={`Przychód ${year}`}>
              <span className="text-[28px] font-light">{formatPln(wonYear)}</span>
              <span className="ml-3 text-xs text-gray-500">łącznie {formatPln(wonAll)} z {deals.length} dealów</span>
            </Row>
            {company.company_type && <Row label="Typ firmy">{TYPE_LABEL[company.company_type] ?? company.company_type}</Row>}
            {company.email && (
              <Row label="E-mail">
                <div className="flex items-center justify-between gap-2">
                  <a className="link break-all" href={`mailto:${company.email}`}>
                    {company.email}
                  </a>
                  <span className="text-sm text-gray-500 border-l border-gray-200 pl-3">Praca</span>
                </div>
              </Row>
            )}
            {company.phone && (
              <Row label="Telefon">
                <div className="flex items-center justify-between gap-2">
                  <a className="link" href={`tel:${company.phone}`}>
                    {company.phone}
                  </a>
                  <span className="text-sm text-gray-500 border-l border-gray-200 pl-3">Praca</span>
                </div>
              </Row>
            )}
            {company.nip && <Row label="NIP">{company.nip}</Row>}
            {company.address && <Row label="Adres">{company.address}</Row>}
            {company.comment && <Row label="Notatka">{company.comment}</Row>}
            <Row label="Osoba odpowiedzialna">{personName(company.owner_id)}</Row>
            <Row label="Utworzono">{formatLong(company.created_at)}</Row>
            <div className="pt-3 flex items-center justify-between text-sm">
              <button type="button" className="text-gray-500 hover:text-gray-800 underline decoration-dotted" onClick={() => setEditing(true)}>
                Edytuj pola
              </button>
              <button type="button" className="text-gray-400 hover:text-danger" onClick={remove}>
                Usuń firmę
              </button>
            </div>
          </Section>
          <BxTimeline entity="company" entityId={companyId} events={events} taskHint="Zaplanuj kolejny krok, żeby niczego nie przegapić" />
        </div>
      )}

      {tab === "deals" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={() => setAddingDeal(true)}>
              + Nowy deal
            </button>
            <input className="input max-w-sm" placeholder="Filtruj i szukaj" value={dealQuery} onChange={(e) => setDealQuery(e.target.value)} aria-label="Filtruj deale firmy" />
          </div>
          <DealGrid deals={filteredDeals} compact onError={setError} />
        </div>
      )}

      {tab === "contacts" && (
        <section className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">Kontakty</h2>
            <button type="button" className="btn-primary py-1.5" onClick={() => setAddingContact(true)}>
              + Kontakt
            </button>
          </div>
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm border-b border-gray-100 last:border-0">
              <span className="font-medium">
                {c.first_name} {c.last_name ?? ""}
              </span>
              {c.position && <span className="text-gray-500">{c.position}</span>}
              {c.phone && (
                <a className="link" href={`tel:${c.phone}`}>
                  {c.phone}
                </a>
              )}
              {c.email && (
                <a className="link" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              )}
              <button type="button" className="ml-auto text-xs text-gray-400 hover:text-gray-700" onClick={() => run(() => updateContact(c.id, { company_id: null }))}>
                odłącz
              </button>
            </div>
          ))}
          {contacts.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">Brak kontaktów</div>}
        </section>
      )}

      {tab === "history" && (
        <section className="rounded-xl bg-white shadow-sm divide-y divide-gray-100">
          {data.stage_history
            .filter((h) => deals.some((d) => d.id === h.deal_id))
            .sort((a, b) => b.moved_at.localeCompare(a.moved_at))
            .slice(0, 200)
            .map((h) => {
              const stage = stageByCode.get(h.stage_code);
              return (
                <div key={h.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-36 text-gray-500">{formatDateTime(h.moved_at)}</span>
                  <span className="w-24 text-link">Deal #{h.deal_id}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: stage?.color }}>
                    {stage?.name ?? h.stage_code}
                  </span>
                  {h.moved_by && <span className="text-gray-400 ml-auto">{personName(h.moved_by)}</span>}
                </div>
              );
            })}
        </section>
      )}

      {editing && <CompanyForm open onClose={() => setEditing(false)} initial={company} onSubmit={(values) => updateCompany(companyId, values)} />}
      {addingDeal && <DealForm open onClose={() => setAddingDeal(false)} stage={null} companyId={companyId} onError={setError} />}
      {addingContact && <ContactForm open onClose={() => setAddingContact(false)} initial={{ ...emptyContact(), company_id: companyId }} onSubmit={async (v) => void (await createContact(v))} />}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
