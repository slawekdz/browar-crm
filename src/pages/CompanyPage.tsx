import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Comment, Deal, Stage } from "@/types";
import { useData } from "@/store";
import { Money, Toast } from "@/components/ui";
import { CompanyForm } from "./Companies";
import { ContactForm, emptyContact } from "./Contacts";
import DealForm from "@/components/DealForm";
import { formatDate, formatDateTime, today } from "@/lib/dates";
import { formatPln } from "@/lib/money";

/*
 * Company card laid out like the Bitrix24 company page: light canvas, title with edit pencil,
 * tabs (General / Deals / Contacts / History), "About company" panel on the left and the
 * timeline with an activity/comment composer, pinned to-dos, date separators and deal events on the right.
 */

type Tab = "general" | "deals" | "contacts" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "Ogólne" },
  { key: "deals", label: "Deale" },
  { key: "contacts", label: "Kontakty" },
  { key: "history", label: "Historia" },
];

const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };
const PAGE = 30;

type Entry =
  | { key: string; at: string; type: "deal_created"; deal: Deal }
  | { key: string; at: string; type: "deal_closed"; deal: Deal; stage: Stage }
  | { key: string; at: string; type: "comment"; comment: Comment };

const dayKey = (iso: string): string => iso.slice(0, 10);
const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (day: string): string => {
  const d = new Date(`${day}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("pl-PL", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }) + (sameYear ? "" : " r.");
};

function Icon({ kind }: { kind: "chat" | "up" | "plus" | "info" | "task" | "deal" }) {
  const paths: Record<string, ReactNode> = {
    chat: <path d="M4 5h16v10H8l-4 4V5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    up: <path d="M12 19V6m0 0l-5 5m5-5l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    plus: <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />,
    info: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></>,
    task: <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
    deal: <path d="M4 7h16v12H4zM4 11h16M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      {paths[kind]}
    </svg>
  );
}

function Rail({ icon, tone = "blue", children }: { icon: "chat" | "up" | "plus" | "info" | "task" | "deal"; tone?: "blue" | "green" | "grey"; children: ReactNode }) {
  const bg = { blue: "bg-[#2fc6f6] text-white", green: "bg-[#9dcf00] text-white", grey: "bg-white text-gray-400 border border-gray-300" }[tone];
  return (
    <div className="relative pl-14">
      <span className={`absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-full ${bg} shadow-sm`}>
        <Icon kind={icon} />
      </span>
      {children}
    </div>
  );
}

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
  const { data, updateCompany, deleteCompany, createContact, updateContact, personName, commentsOf, addComment, updateComment, deleteComment } = useData();
  const company = data.companies.find((c) => c.id === companyId);
  const [tab, setTab] = useState<Tab>("general");
  const [editing, setEditing] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [composer, setComposer] = useState<"task" | "comment">("task");
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState(today());
  const [editId, setEditId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);

  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const deals = useMemo(() => data.deals.filter((d) => d.company_id === companyId).sort((a, b) => b.id - a.id), [data.deals, companyId]);
  const contacts = data.contacts.filter((c) => c.company_id === companyId);
  const comments = commentsOf("company", companyId);
  const openTasks = comments.filter((c) => c.kind === "task" && !c.completed);
  const pinned = comments.filter((c) => c.pinned);
  const year = new Date().getFullYear();
  const wonAll = deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);
  const wonYear = deals.filter((d) => d.stage_code === "WON" && (d.close_date ?? d.created_at).startsWith(String(year))).reduce((s, d) => s + d.amount, 0);

  const entries = useMemo<Entry[]>(() => {
    const dealIds = new Set(deals.map((d) => d.id));
    const dealById = new Map(deals.map((d) => [d.id, d]));
    const list: Entry[] = deals.map((d) => ({ key: `c${d.id}`, at: d.created_at, type: "deal_created", deal: d }));
    for (const h of data.stage_history) {
      if (!dealIds.has(h.deal_id)) continue;
      const stage = stageByCode.get(h.stage_code);
      if (!stage || stage.semantic === "open") continue;
      list.push({ key: `h${h.id}`, at: h.moved_at, type: "deal_closed", deal: dealById.get(h.deal_id)!, stage });
    }
    for (const c of comments) if (!(c.kind === "task" && !c.completed) && !c.pinned) list.push({ key: `m${c.id}`, at: c.created_at, type: "comment", comment: c });
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [deals, data.stage_history, comments, stageByCode]);

  const grouped = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    for (const e of entries.slice(0, limit)) {
      const day = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [entries, limit]);

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

  const submitComposer = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    run(async () => {
      await addComment("company", companyId, composer === "task" ? { kind: "task", body, deadline: `${deadline}T18:00:00` } : { kind: "comment", body, deadline: null });
      setDraft("");
    });
  };

  const saveEdit = (c: Comment) =>
    run(async () => {
      if (editBody.trim() && editBody.trim() !== c.body) await updateComment(c.id, { body: editBody.trim() });
      setEditId(null);
    });

  const remove = () => {
    if (!window.confirm(`Usunąć firmę ${company.name}?`)) return;
    run(async () => {
      await deleteCompany(companyId);
      navigate("/companies");
    });
  };

  const commentCard = (c: Comment, showPinned = false) => (
    <Rail key={c.id} icon={c.kind === "task" ? "task" : "chat"} tone={c.kind === "task" && c.completed ? "green" : "blue"}>
      <article className="rounded-xl bg-white shadow-sm p-4">
        <header className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800">{c.kind === "task" ? (c.completed ? "Zadanie wykonane" : "Zadanie") : "Komentarz"}</span>
          {showPinned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">przypięte</span>}
          <span className="text-gray-400">{timeOf(c.created_at)}</span>
          <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700" title={personName(c.author_id)}>
            {personName(c.author_id).split(" ").map((s) => s[0]).join("").slice(0, 2)}
          </span>
        </header>
        <div className="mt-3 flex gap-3">
          <div className="hidden sm:flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-[#e8f7fd] text-[#2fc6f6]">
            <Icon kind={c.kind === "task" ? "task" : "chat"} />
          </div>
          <div className="flex-1 min-w-0">
            {editId === c.id ? (
              <div className="space-y-2">
                <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2fc6f6]" rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-[#2fc6f6] px-3 py-1.5 text-sm font-medium text-white" onClick={() => saveEdit(c)}>
                    Zapisz
                  </button>
                  <button type="button" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" onClick={() => setEditId(null)}>
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap">
                <span className="flex-1">{c.body}</span>
                <button type="button" className="text-gray-300 hover:text-gray-600" title="Edytuj" aria-label="Edytuj wpis" onClick={() => (setEditId(c.id), setEditBody(c.body))}>
                  ✎
                </button>
              </div>
            )}
            {c.deadline && <div className="mt-1 text-xs text-gray-500">termin: {formatDateTime(c.deadline)}</div>}
            {c.files.length > 0 && <div className="mt-1 text-xs text-gray-500">załączniki (Bitrix): {c.files.map((f) => f.name).join(", ")}</div>}
          </div>
        </div>
        <footer className="mt-3 flex items-center gap-2">
          {c.kind === "task" && !c.completed ? (
            <button type="button" className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50" onClick={() => run(() => updateComment(c.id, { completed: true }))}>
              Wykonane
            </button>
          ) : (
            <button type="button" className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50" onClick={() => run(() => updateComment(c.id, { pinned: !c.pinned }))}>
              {c.pinned ? "Odepnij" : "Przypnij"}
            </button>
          )}
          <button type="button" className="ml-auto text-gray-400 hover:text-red-500 text-sm" onClick={() => window.confirm("Usunąć wpis?") && run(() => deleteComment(c.id))} aria-label="Usuń wpis">
            Usuń
          </button>
        </footer>
      </article>
    </Rail>
  );

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
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/companies" className="text-xs text-gray-500">
            ← Firmy
          </Link>
        </div>
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
            <section className="rounded-xl bg-white shadow-sm p-5">
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

            <section className="space-y-4 relative">
              <div className="absolute left-[18px] top-4 bottom-4 w-px bg-gray-300 hidden sm:block" aria-hidden />
              <Rail icon="chat">
                <form onSubmit={submitComposer} className="rounded-xl bg-white shadow-sm p-4">
                  <div className="flex gap-1 text-[15px]">
                    <button type="button" className={`rounded-lg px-3 py-1.5 ${composer === "task" ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600"}`} onClick={() => setComposer("task")}>
                      Aktywność
                    </button>
                    <button type="button" className={`rounded-lg px-3 py-1.5 ${composer === "comment" ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600"}`} onClick={() => setComposer("comment")}>
                      Komentarz
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <textarea
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2fc6f6]"
                      rows={composer === "task" ? 1 : 3}
                      placeholder={composer === "task" ? "Do zrobienia" : "Komentarz"}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      aria-label={composer === "task" ? "Do zrobienia" : "Komentarz"}
                    />
                    {composer === "task" && <input type="date" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Termin" />}
                    <button type="submit" className="rounded-xl bg-[#2fc6f6] px-4 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={!draft.trim()}>
                      {composer === "task" ? "Zaplanuj" : "Wyślij"}
                    </button>
                  </div>
                </form>
              </Rail>

              <div className="flex justify-center">
                <span className="rounded-full bg-[#9dcf00] px-4 py-1 text-xs font-semibold text-white">Do zrobienia</span>
              </div>
              {openTasks.length === 0 ? (
                <Rail icon="info" tone="green">
                  <button type="button" className="w-full text-left rounded-xl bg-[#fff8dc] p-4 flex items-center gap-3" onClick={() => (setComposer("task"), document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Do zrobienia']")?.focus())}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9dcf00] text-white">
                      <Icon kind="plus" />
                    </span>
                    <span>
                      <span className="block font-medium text-gray-900">Dodaj nową aktywność</span>
                      <span className="block text-sm text-gray-500">Zaplanuj kolejny krok, żeby niczego nie przegapić</span>
                    </span>
                  </button>
                </Rail>
              ) : (
                openTasks.map((c) => commentCard(c))
              )}
              {pinned.map((c) => commentCard(c, true))}

              {grouped.map((group) => (
                <div key={group.day} className="space-y-4">
                  <div className="flex justify-center">
                    <span className="rounded-full bg-gray-200 px-4 py-1 text-xs font-medium text-gray-600">{dayLabel(group.day)}</span>
                  </div>
                  {group.items.map((e) => {
                    if (e.type === "comment") return commentCard(e.comment);
                    const closed = e.type === "deal_closed";
                    return (
                      <Rail key={e.key} icon={closed ? "up" : "deal"} tone="grey">
                        <article className="rounded-xl bg-white shadow-sm p-4 text-sm">
                          <header className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-500">{closed ? "Deal zakończony" : "Deal utworzony"}</span>
                            {closed ? (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.stage.semantic === "won" ? "bg-[#dff3c2] text-[#4a6b00]" : "bg-red-100 text-red-700"}`}>{e.stage.name}</span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{stageByCode.get(e.deal.stage_code)?.name}</span>
                            )}
                            <span className="text-gray-400">{timeOf(e.at)}</span>
                            <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700" title={personName(e.deal.owner_id)}>
                              {personName(e.deal.owner_id).split(" ").map((s) => s[0]).join("").slice(0, 2)}
                            </span>
                          </header>
                          <div className="mt-2 text-gray-700">
                            Deal{" "}
                            <Link to={`/deals/${e.deal.id}`} className="text-[#0b66c3] hover:underline">
                              {e.deal.title}
                            </Link>
                            <span className="text-gray-500"> · {formatPln(e.deal.amount)}</span>
                          </div>
                        </article>
                      </Rail>
                    );
                  })}
                </div>
              ))}
              {entries.length > limit && (
                <div className="flex justify-center">
                  <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setLimit((l) => l + PAGE)}>
                    Pokaż więcej ({entries.length - limit})
                  </button>
                </div>
              )}
            </section>
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
