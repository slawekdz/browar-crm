import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { RECORD_RE, isRecordPath } from "@/lib/nav";
import MobileDeals from "./MobileDeals";
import { MobileCompanies, MobileContacts, MobileProducts } from "./MobileLists";
import { MobileDeal, MobileCompany, MobileProduct } from "./MobileRecord";
import MobileTasks from "./MobileTasks";
import Settings from "@/pages/Settings";
import DealForm from "@/components/DealForm";
import { CompanyForm, emptyCompany } from "@/pages/Companies";
import { ContactForm, emptyContact } from "@/pages/Contacts";
import { Fab, MIcon } from "./ui";
import { useOpenRecord } from "@/lib/nav";

/*
 * Bitrix24 mobile shell: "CRM" header with filter/search/⋯, entity pills (Deale / Kontakty / Firmy /
 * Produkty), the list underneath, a "+" FAB and the bottom bar (CRM / Zadania / Menu).
 * Record routes render full-screen record pages instead of sliders.
 */
type Section = "/" | "/contacts" | "/companies" | "/products";
const PILLS: [Section, string][] = [
  ["/", "Deale"],
  ["/contacts", "Kontakty"],
  ["/companies", "Firmy"],
  ["/products", "Produkty"],
];

export default function MobileShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const openRecord = useOpenRecord();
  const { data, createCompany, createContact } = useStore();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<Section | null>(null);
  const path = location.pathname;
  const isRecord = isRecordPath(path);
  const openTasks = data?.comments.filter((c) => c.kind === "task" && !c.completed).length ?? 0;

  useEffect(() => {
    if (!isRecord) document.title = "CRM · Browar Pogórza";
  }, [isRecord]);

  if (isRecord) {
    const m = RECORD_RE.exec(path)!;
    const id = Number(m[2]);
    return <div className="bxm min-h-full">{m[1] === "deals" ? <MobileDeal id={id} /> : m[1] === "companies" ? <MobileCompany id={id} /> : <MobileProduct id={id} />}</div>;
  }

  const section: Section | "/tasks" | "/settings" = path === "/settings" ? "/settings" : path === "/tasks" ? "/tasks" : (PILLS.find(([p]) => p === path)?.[0] ?? "/");
  const inCrm = section !== "/settings" && section !== "/tasks";

  return (
    <div className="bxm flex min-h-full flex-col">
      <header className="sticky top-0 z-30" style={{ background: "var(--m-bg)" }}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <h1 className="mr-auto text-[26px] font-semibold">{section === "/settings" ? "Menu" : section === "/tasks" ? "Zadania" : "CRM"}</h1>
          {inCrm && (
            <>
              <button type="button" className="p-2 m-muted" aria-label="Filtr" onClick={() => setSearching((s) => !s)}>
                <MIcon name="funnel" className="h-6 w-6" />
              </button>
              <button type="button" className="p-2 m-muted" aria-label="Szukaj" onClick={() => setSearching((s) => !s)}>
                <MIcon name="search" className="h-6 w-6" />
              </button>
              <button type="button" className="p-2 m-muted" aria-label="Więcej" onClick={() => navigate("/settings")}>
                <MIcon name="more" className="h-6 w-6" strokeWidth={3} />
              </button>
            </>
          )}
        </div>
        {inCrm && searching && (
          <div className="px-4 pb-2">
            <input className="m-input" placeholder="Filtruj i szukaj" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filtruj i szukaj" autoFocus />
          </div>
        )}
        {inCrm && (
          <div className="scroll-x flex gap-2 overflow-x-auto px-4 pb-3">
            {PILLS.map(([p, label]) => (
              <button key={p} type="button" className={`m-pill relative ${section === p ? "m-pill-active" : ""}`} onClick={() => navigate(p)}>
                {label}
                {p === "/" && data && <span className="absolute -right-1 -top-2 rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{data.deals.filter((d) => !d.closed).length}</span>}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        {section === "/" && <MobileDeals query={query} />}
        {section === "/contacts" && <MobileContacts query={query} />}
        {section === "/companies" && <MobileCompanies query={query} />}
        {section === "/products" && <MobileProducts query={query} />}
        {section === "/tasks" && <MobileTasks />}
        {section === "/settings" && (
          <div className="px-3 pt-3 pb-28 text-ink [&_.card]:!bg-[#1b1f28] [&_.card]:!border-[#2c3340] [&_.card]:!text-[#eef1f5] [&_h1]:hidden [&_.text-muted]:!text-[#9aa3b2] [&_.input]:!bg-[#0f1218] [&_.input]:!text-white [&_.input]:!border-[#3a4150]">
            <Settings />
          </div>
        )}
      </main>

      {inCrm && section !== "/products" && <Fab onClick={() => setCreating(section as Section)} />}

      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-[#2c3340] pb-[env(safe-area-inset-bottom)]" style={{ background: "#12151c" }}>
        {(
          [
            ["/", "CRM", "funnel"],
            ["/tasks", "Zadania", "tasks"],
            ["/settings", "Menu", "menu"],
          ] as [string, string, string][]
        ).map(([to, label, icon]) => {
          const active = to === "/" ? inCrm : section === to;
          return (
            <button key={to} type="button" className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[13px] ${active ? "m-link" : "m-muted"}`} onClick={() => navigate(to)}>
              <MIcon name={icon} className="h-6 w-6" />
              {label}
              {to === "/tasks" && openTasks > 0 && <span className="absolute left-1/2 top-1 ml-2 rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{openTasks}</span>}
            </button>
          );
        })}
      </nav>

      {creating === "/" && <DealForm open onClose={() => setCreating(null)} stage={null} onError={(m) => window.alert(m)} />}
      {creating === "/companies" && (
        <CompanyForm
          open
          onClose={() => setCreating(null)}
          initial={emptyCompany()}
          onSubmit={async (v) => {
            const row = await createCompany(v);
            openRecord(`/companies/${row.id}`);
          }}
        />
      )}
      {creating === "/contacts" && <ContactForm open onClose={() => setCreating(null)} initial={emptyContact()} onSubmit={async (v) => void (await createContact(v))} />}
    </div>
  );
}
