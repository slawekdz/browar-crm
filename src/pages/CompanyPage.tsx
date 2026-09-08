import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Deal } from "@/types";
import { useData } from "@/store";
import { Money, Toast } from "@/components/ui";
import { CompanyForm } from "./Companies";
import { ContactForm, emptyContact } from "./Contacts";
import DealForm from "@/components/DealForm";
import BxTimeline, { type TimelineEvent } from "@/components/BxTimeline";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPln } from "@/lib/money";

/*
 * Company card laid out like the Bitrix24 company page: light canvas, title with edit pencil,
 * tabs (General / Deals / Contacts / History), "About company" panel on the left and the timeline on the right.
 */

type Tab = "general" | "deals" | "contacts" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "Ogólne" },
  { key: "deals", label: "Deale" },
  { key: "contacts", label: "Kontakty" },
  { key: "history", label: "Historia" },
];
const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-[15px] text-gray-900">{children}</div>
    </div>
  );
}

export default function CompanyPage() {
  const { id } = useParams();
  const companyId = Number(id);
  const navigate = useNavigate();
  const { data, updateCompany, deleteCompany, createContact, updateContact, personName } = useData();
  const company = data.companies.find((c) => c.id === companyId);
  const [tab, setTab] = useState<Tab>("general");
  const [editing, setEditing] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const deals = useMemo(() => data.deals.filter((d) => d.company_id === companyId).sort((a, b) => b.id - a.id), [data.deals, companyId]);
  const contacts = data.contacts.filter((c) => c.company_id === companyId);
  const year = new Date().getFullYear();
  const wonAll = deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);
  const wonYear = deals.filter((d) => d.stage_code === "WON" && (d.close_date ?? d.created_at).startsWith(String(year))).reduce((s, d) => s + d.amount, 0);

  const events = useMemo<TimelineEvent[]>(() => {
    const dealById = new Map(deals.map((d) => [d.id, d]));
    const list: TimelineEvent[] = deals.map((d) => ({
      key: `c${d.id}`,
      at: d.created_at,
      title: "Deal utworzony",
      icon: "deal",
      pills: [{ text: stageByCode.get(d.stage_code)?.name ?? d.stage_code, tone: "grey" }],
      link: { to: `/deals/${d.id}`, label: d.title },
      suffix: formatPln(d.amount),
      ownerId: d.owner_id,
    }));
    for (const h of data.stage_history) {
      const deal = dealById.get(h.deal_id);
      const stage = stageByCode.get(h.stage_code);
      if (!deal || !stage || stage.semantic === "open") continue;
      list.push({
        key: `h${h.id}`,
        at: h.moved_at,
        title: "Deal zakończony",
        icon: "up",
        pills: [{ text: stage.name, tone: stage.semantic === "won" ? "won" : "lost" }],
        link: { to: `/deals/${deal.id}`, label: deal.title },
        suffix: formatPln(deal.amount),
        ownerId: h.moved_by ?? deal.owner_id,
      });
    }
    return list;
  }, [deals, data.stage_history, stageByCode]);

  if (!company)
    return (
      <div className="p-6 text-muted">
        Nie ma takiej firmy. <Link to="/companies" className="text-sky-300">Wróć</Link>
      </div>
    );

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
      navigate("/companies");
    });
  };

  const dealRow = (d: Deal) => {
    const stage = stageByCode.get(d.stage_code);
    return (
      <Link key={d.id} to={`/deals/${d.id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[7rem_1fr_9rem_7rem] items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
        <span className="font-medium text-[#0b66c3]">{d.title}</span>
        <span className="hidden sm:block text-gray-500 truncate">{d.comment ?? ""}</span>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white w-fit" style={{ background: stage?.color }}>
          {stage?.name}
        </span>
        <span className="hidden sm:block text-right text-gray-900 tabular-nums">{formatPln(d.amount)}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-full bg-[#eef2f6] text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-5 space-y-4">
        <Link to="/companies" className="text-xs text-gray-500">
          ← Firmy
        </Link>
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 mr-auto">
            <h1 className="text-2xl sm:text-3xl font-light text-gray-900 flex items-center gap-2 flex-wrap">
              <span>{company.name}</span>
              <button type="button" className="text-gray-400 hover:text-gray-700 text-lg" onClick={() => setEditing(true)} aria-label="Edytuj firmę" title="Edytuj">
                ✎
              </button>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-[#2fc6f6]" title="Zadzwoń" aria-label="Zadzwoń">
                ☎
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-[#2fc6f6]" title="Napisz e-mail" aria-label="Napisz e-mail">
                ✉
              </a>
            )}
            <button type="button" className="rounded-lg bg-[#2fc6f6] px-4 py-2 text-sm font-medium text-white hover:bg-[#1eb5e6]" onClick={() => setAddingDeal(true)}>
              + Deal
            </button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto scroll-x text-[15px]">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`rounded-lg px-4 py-2 whitespace-nowrap ${tab === t.key ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600 hover:text-gray-900"}`} onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === "deals" && ` (${deals.length})`}
              {t.key === "contacts" && ` (${contacts.length})`}
            </button>
          ))}
        </nav>

        {tab === "general" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
            <section className="rounded-xl bg-white shadow-sm p-5 min-w-0 break-words">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">O firmie</h2>
                <button type="button" className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setEditing(true)}>
                  edytuj
                </button>
              </div>
              <Stat label={`Przychód ${year}`}>
                <span className="text-3xl font-light">{formatPln(wonYear)}</span>
                <span className="ml-3 text-xs text-gray-500">łącznie {formatPln(wonAll)} z {deals.length} dealów</span>
              </Stat>
              {company.email && (
                <Stat label="E-mail">
                  <div className="flex items-center justify-between gap-2">
                    <a className="text-[#0b66c3] hover:underline break-all" href={`mailto:${company.email}`}>
                      {company.email}
                    </a>
                    <span className="text-sm text-gray-500 border-l border-gray-200 pl-3">Praca</span>
                  </div>
                </Stat>
              )}
              {company.phone && (
                <Stat label="Telefon">
                  <div className="flex items-center justify-between gap-2">
                    <a className="text-[#0b66c3] hover:underline" href={`tel:${company.phone}`}>
                      {company.phone}
                    </a>
                    <span className="text-sm text-gray-500 border-l border-gray-200 pl-3">Praca</span>
                  </div>
                </Stat>
              )}
              {company.nip && <Stat label="NIP">{company.nip}</Stat>}
              {company.address && <Stat label="Adres">{company.address}</Stat>}
              {company.company_type && <Stat label="Typ firmy">{TYPE_LABEL[company.company_type] ?? company.company_type}</Stat>}
              {company.comment && <Stat label="Notatka">{company.comment}</Stat>}
              <Stat label="Osoba odpowiedzialna">{personName(company.owner_id)}</Stat>
              <Stat label="Utworzono">{formatDate(company.created_at)}</Stat>
              <div className="pt-3 flex items-center justify-between text-sm">
                <button type="button" className="text-gray-500 hover:text-gray-800 underline decoration-dotted" onClick={() => setEditing(true)}>
                  Edytuj pola
                </button>
                <button type="button" className="text-gray-400 hover:text-red-600" onClick={remove}>
                  Usuń firmę
                </button>
              </div>
            </section>
            <BxTimeline entity="company" entityId={companyId} events={events} taskHint="Zaplanuj kolejny krok, żeby niczego nie przegapić" />
          </div>
        )}

        {tab === "deals" && (
          <section className="rounded-xl bg-white shadow-sm">
            <div className="hidden sm:grid grid-cols-[7rem_1fr_9rem_7rem] gap-2 px-4 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <span>Deal</span>
              <span>Komentarz</span>
              <span>Etap</span>
              <span className="text-right">Kwota</span>
            </div>
            {deals.map(dealRow)}
            {deals.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">Brak dealów</div>}
            <div className="px-4 py-3 text-sm text-gray-500 border-t border-gray-200">
              {deals.length} dealów · wygrane <Money value={wonAll} className="text-gray-900" />
            </div>
          </section>
        )}

        {tab === "contacts" && (
          <section className="rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Kontakty</h2>
              <button type="button" className="rounded-lg bg-[#2fc6f6] px-3 py-1.5 text-sm font-medium text-white" onClick={() => setAddingContact(true)}>
                + Kontakt
              </button>
            </div>
            {contacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm border-b border-gray-100 last:border-0">
                <span className="font-medium text-gray-900">
                  {c.first_name} {c.last_name ?? ""}
                </span>
                {c.position && <span className="text-gray-500">{c.position}</span>}
                {c.phone && (
                  <a className="text-[#0b66c3]" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a className="text-[#0b66c3]" href={`mailto:${c.email}`}>
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
                    <Link to={`/deals/${h.deal_id}`} className="w-24 text-[#0b66c3]">
                      Deal #{h.deal_id}
                    </Link>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: stage?.color }}>
                      {stage?.name ?? h.stage_code}
                    </span>
                    {h.moved_by && <span className="text-gray-400 ml-auto">{personName(h.moved_by)}</span>}
                  </div>
                );
              })}
          </section>
        )}
      </div>

      {editing && <CompanyForm open onClose={() => setEditing(false)} initial={company} onSubmit={(values) => updateCompany(companyId, values)} />}
      {addingDeal && <DealForm open onClose={() => setAddingDeal(false)} stage={null} companyId={companyId} onError={setError} />}
      {addingContact && <ContactForm open onClose={() => setAddingContact(false)} initial={{ ...emptyContact(), company_id: companyId }} onSubmit={async (v) => void (await createContact(v))} />}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
