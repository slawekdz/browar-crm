import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { Deal, NewLine } from "@/types";
import { useData } from "@/store";
import { useCloseSlider, useOpenRecord } from "@/lib/nav";
import { formatLong, formatDateTime } from "@/lib/dates";
import { formatPln } from "@/lib/money";
import { dealEvents, companyEvents } from "@/lib/events";
import MobileTimeline from "./MobileTimeline";
import MobileDealProducts from "./MobileDealProducts";
import { StageChevron, StagePicker, DealMobileCard } from "./MobileDeals";
import { CompanyForm } from "@/pages/Companies";
import { ContactForm, emptyContact } from "@/pages/Contacts";
import { ProductForm } from "@/pages/Products";
import { CompanyPicker } from "@/components/Pickers";
import { MAvatar, MIcon, Sheet, SheetItem } from "./ui";

/*
 * Bitrix24 mobile record screen: header with a "⌄" close chevron, a coloured entity badge,
 * title + subtitle, "⋯" (or "Zapisz" when the product tab has unsaved changes), tab pills
 * (Szczegóły / Oś czasu / Produkty) and the dark section cards of the details tab.
 */
type Tab = "details" | "timeline" | "products" | "deals";
const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Klient", SUPPLIER: "Dostawca", PARTNER: "Partner", COMPETITOR: "Konkurencja", OTHER: "Inne" };

function Header({ badge, color, title, subtitle, onClose, right }: { badge: string; color: string; title: string; subtitle: string; onClose: () => void; right: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-3 px-3 py-3" style={{ background: "var(--m-bg)" }}>
      <button type="button" className="p-2" onClick={onClose} aria-label="Zamknij">
        <MIcon name="down" className="h-7 w-7" strokeWidth={2.2} />
      </button>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
        <MIcon name={badge} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[19px] font-semibold">{title}</div>
        <div className="truncate text-[15px] m-muted">{subtitle}</div>
      </div>
      {right}
    </header>
  );
}

function Tabs({ tabs, value, onChange }: { tabs: [Tab, string][]; value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="scroll-x flex gap-2 overflow-x-auto px-3 pb-3">
      {tabs.map(([key, label]) => (
        <button key={key} type="button" className={`m-pill ${value === key ? "m-pill-active" : ""}`} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, onEdit, children, footer = true }: { title: string; onEdit?: () => void; children: ReactNode; footer?: boolean }) {
  return (
    <section className="m-card px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide">{title}</h2>
        {onEdit && (
          <button type="button" className="text-[15px] m-muted underline decoration-dotted" onClick={onEdit}>
            edytuj
          </button>
        )}
      </div>
      <div className="mt-3 divide-y divide-[#2c3340]">{children}</div>
      {footer && (
        <div className="mt-3 flex gap-4 text-[15px] m-muted">
          <span>Wybierz pole</span>
          <span>Dodaj pole</span>
          <span className="ml-auto">Usuń sekcję</span>
        </div>
      )}
    </section>
  );
}

function Field({ label, children, onClear }: { label: string; children: ReactNode; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-2 py-3">
      <div className="min-w-0 flex-1">
        <div className="m-label">{label}</div>
        <div className="mt-1 text-[19px]">{children}</div>
      </div>
      {onClear && (
        <button type="button" className="p-2 m-muted" onClick={onClear} aria-label="Wyczyść">
          <MIcon name="close" />
        </button>
      )}
    </div>
  );
}

function useTabFromUrl(defaultTab: Tab): [Tab, (t: Tab) => void] {
  const location = useLocation();
  const initial = (new URLSearchParams(location.search).get("tab") as Tab | null) ?? defaultTab;
  const [tab, setTab] = useState<Tab>(initial);
  return [tab, setTab];
}

/* ---------------------------------------------------------------- deal */
export function MobileDeal({ id }: { id: number }) {
  const { data, companyById, contactById, personName, linesOf, moveDeal, updateDeal, deleteDeal } = useData();
  const close = useCloseSlider();
  const openRecord = useOpenRecord();
  const location = useLocation();
  const deal = data.deals.find((d) => d.id === id);
  const [tab, setTab] = useTabFromUrl("details");
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editClient, setEditClient] = useState(false);
  const [saveFn, setSaveFn] = useState<(() => Promise<void>) | null>(null);
  const [saving, setSaving] = useState(false);
  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const events = useMemo(() => (deal ? dealEvents(data, deal, stageByCode) : []), [data, deal, stageByCode]);
  const saved = linesOf(id);
  useEffect(() => {
    if (deal) document.title = `${deal.title} · Browar Pogórza CRM`;
  }, [deal]);
  if (!deal) return <div className="p-6 m-muted">Nie ma takiego dealu.</div>;
  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
  const compose = new URLSearchParams(location.search).get("compose") === "task";
  const save = async () => {
    if (!saveFn) return;
    setSaving(true);
    try {
      await saveFn();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bxm min-h-full">
      <Header
        badge="deal"
        color="#7b5ad8"
        title={deal.title}
        subtitle={deal.repeat_customer ? "Powtarzalny deal" : "Deal"}
        onClose={close}
        right={
          saveFn ? (
            <button type="button" className="px-3 py-2 text-[19px] m-link" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </button>
          ) : (
            <>
              <button type="button" className="p-2 text-red-400" onClick={() => window.confirm(`Usunąć ${deal.title}? Tej operacji nie da się cofnąć.`) && deleteDeal(id).then(close)} aria-label="Usuń deal" title="Usuń deal">
                <MIcon name="trash" className="h-6 w-6" />
              </button>
              <button type="button" className="p-2 m-muted" onClick={() => setMenu(true)} aria-label="Menu">
                <MIcon name="more" className="h-6 w-6" strokeWidth={3} />
              </button>
            </>
          )
        }
      />
      <Tabs tabs={[["details", "Szczegóły"], ["timeline", "Oś czasu"], ["products", "Produkty"]]} value={tab} onChange={setTab} />

      {tab === "details" && (
        <div className="space-y-3 px-3 pb-32">
          <Section title="Więcej">
            <Field label="Typ dealu">
              <span className="inline-flex items-center gap-1">
                Sprzedaż <MIcon name="down" className="h-4 w-4 m-muted" />
              </span>
            </Field>
            <Field label="Data początkowa" onClear={deal.begin_date ? () => updateDeal(id, { begin_date: null }) : undefined}>
              <input type="date" className="bg-transparent text-[19px] focus:outline-none" value={deal.begin_date ?? ""} onChange={(e) => updateDeal(id, { begin_date: e.target.value || null })} aria-label="Data początkowa" />
            </Field>
            <Field label="Data końcowa" onClear={deal.close_date ? () => updateDeal(id, { close_date: null }) : undefined}>
              <input type="date" className="bg-transparent text-[19px] focus:outline-none" value={deal.close_date ?? ""} onChange={(e) => updateDeal(id, { close_date: e.target.value || null })} aria-label="Data końcowa" />
            </Field>
            <Field label="Dostępne dla wszystkich">
              <span className="inline-block h-7 w-12 rounded-full bg-[#4fd1e0] p-1">
                <span className="block h-5 w-5 translate-x-5 rounded-full bg-white" />
              </span>
            </Field>
            <Field label="Komentarz">
              <input className="w-full bg-transparent text-[19px] placeholder:text-[#5c6675] focus:outline-none" defaultValue={deal.comment ?? ""} placeholder="—" onBlur={(e) => e.target.value !== (deal.comment ?? "") && updateDeal(id, { comment: e.target.value || null })} aria-label="Komentarz" />
            </Field>
            <div className="py-3">
              <div className="rounded-xl border border-[#2c3340] px-3 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="m-label">Odpowiedzialny</div>
                    <div className="mt-1 flex items-center gap-2 text-[19px] m-link">
                      <MAvatar name={personName(deal.owner_id)} />
                      {personName(deal.owner_id)}
                    </div>
                  </div>
                  <MIcon name="pencil" className="h-5 w-5 m-muted" />
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-[#2c3340] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="m-label">Klient</div>
                    {company ? (
                      <>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[19px]">
                          <button type="button" className="m-link text-left" onClick={() => openRecord(`/companies/${company.id}`)}>
                            {company.name}
                          </button>
                          <span className="rounded-full border border-[#3ea0ea] px-2 py-0.5 text-[12px] m-link">firma</span>
                        </div>
                        <div className="text-[15px] m-muted">{[company.company_type && TYPE_LABEL[company.company_type], company.nip && `NIP ${company.nip}`].filter(Boolean).join(", ")}</div>
                        {company.email && <div className="text-[15px] m-muted">{company.email}</div>}
                        {contact && (
                          <div className="mt-1 text-[15px]">
                            {contact.first_name} {contact.last_name ?? ""} {contact.phone && <span className="m-muted">· {contact.phone}</span>}
                          </div>
                        )}
                      </>
                    ) : (
                      <button type="button" className="mt-1 text-[19px] m-link" onClick={() => setEditClient(true)}>
                        Wybierz firmę
                      </button>
                    )}
                    <button type="button" className="mt-2 flex items-center gap-2 text-[17px]" onClick={() => setEditClient(true)}>
                      <MIcon name="search" className="h-4 w-4 m-muted" /> {company ? "Zmień klienta" : "Dodaj kontakt"}
                    </button>
                  </div>
                  <button type="button" className="p-1 m-muted" onClick={() => setEditClient(true)} aria-label="Edytuj klienta">
                    <MIcon name="pencil" />
                  </button>
                </div>
                {editClient && (
                  <div className="mt-3 space-y-2 text-ink">
                    <CompanyPicker value={deal.company_id} onChange={(cid) => (updateDeal(id, { company_id: cid, contact_id: null }), setEditClient(false))} />
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Wymagane pola">
            <div className="py-3">
              <div className="m-label">Etap</div>
              <div className="mt-2 px-4">
                <StageChevron stages={data.stages} current={deal.stage_code} onPick={() => setPicking(true)} />
              </div>
            </div>
          </Section>

          <Section title="Produkty" onEdit={() => setTab("products")}>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="m-label">Produkty</div>
                <button type="button" className="mt-1 flex items-center gap-2 text-[19px] m-link" onClick={() => setTab("products")}>
                  <MIcon name="box" className="h-5 w-5 m-muted" /> Pozycje: {saved.length}
                </button>
              </div>
              <div className="text-right">
                <div className="m-label">Kwota</div>
                <div className="mt-1 text-[22px] font-semibold tabular-nums">{formatPln(deal.amount)}</div>
              </div>
            </div>
          </Section>

          <Section title="Informacje" footer={false}>
            <Field label="Utworzono">{formatDateTime(deal.created_at)}</Field>
            <Field label="Ostatnia zmiana">{formatDateTime(deal.updated_at)}</Field>
          </Section>
        </div>
      )}

      {tab === "timeline" && <MobileTimeline entity="deal" entityId={id} events={events} hint="Zaplanuj kolejne działanie na dealu, aby nigdy nie zapomnieć o kliencie" composeOnMount={compose} />}

      {/* wrap in a thunk: React would otherwise treat the passed function as a state updater */}
      {tab === "products" && <MobileDealProducts dealId={id} saved={saved as NewLine[]} onDirty={(dirty, fn) => setSaveFn(() => (dirty ? fn : null))} />}

      <div className="m-dock-pos pointer-events-none fixed left-1/2 z-30 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#3ea0ea] px-3 py-2" style={{ background: "var(--m-card)" }}>
          <a href={company?.phone ? `tel:${company.phone}` : undefined} className={`m-round h-9 w-9 ${company?.phone ? "m-round-on" : "opacity-40"}`} aria-label="Zadzwoń">
            <MIcon name="phone" className="h-4.5 w-4.5" />
          </a>
          <a href={company?.email ? `mailto:${company.email}` : undefined} className={`m-round h-9 w-9 ${company?.email ? "m-round-on" : "opacity-40"}`} aria-label="E-mail">
            <MIcon name="mail" className="h-4.5 w-4.5" />
          </a>
          <span className="m-round h-9 w-9 opacity-40" aria-label="Czat">
            <MIcon name="chat" className="h-4.5 w-4.5" />
          </span>
        </div>
      </div>

      <StagePicker open={picking} onClose={() => setPicking(false)} stages={data.stages} current={deal.stage_code} onPick={(code) => moveDeal(id, code)} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={deal.title}>
        <SheetItem icon="funnel" onClick={() => (setPicking(true), setMenu(false))}>
          Zmień etap
        </SheetItem>
        <SheetItem icon="tasks" onClick={() => (setTab("timeline"), setMenu(false))}>
          Zaplanuj aktywność
        </SheetItem>
        <SheetItem icon="trash" danger onClick={() => window.confirm(`Usunąć ${deal.title}?`) && deleteDeal(id).then(close)}>
          Usuń deal
        </SheetItem>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- company */
export function MobileCompany({ id }: { id: number }) {
  const { data, personName, updateCompany, deleteCompany, createContact, moveDeal } = useData();
  const close = useCloseSlider();
  const openRecord = useOpenRecord();
  const company = data.companies.find((c) => c.id === id);
  const [tab, setTab] = useTabFromUrl("details");
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [stageFor, setStageFor] = useState<Deal | null>(null);
  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);
  const events = useMemo(() => (company ? companyEvents(data, company, stageByCode) : []), [data, company, stageByCode]);
  const deals = useMemo(() => data.deals.filter((d) => d.company_id === id).sort((a, b) => b.id - a.id), [data.deals, id]);
  const contacts = data.contacts.filter((c) => c.company_id === id);
  useEffect(() => {
    if (company) document.title = `${company.name} · Browar Pogórza CRM`;
  }, [company]);
  if (!company) return <div className="p-6 m-muted">Nie ma takiej firmy.</div>;
  const won = deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);

  return (
    <div className="bxm min-h-full">
      <Header badge="building" color="#e0a52a" title={company.name} subtitle="Firma" onClose={close} right={<button type="button" className="p-2 m-muted" onClick={() => setMenu(true)} aria-label="Menu"><MIcon name="more" className="h-6 w-6" strokeWidth={3} /></button>} />
      <Tabs tabs={[["details", "Szczegóły"], ["timeline", "Oś czasu"], ["deals", `Deale (${deals.length})`]]} value={tab} onChange={setTab} />
      {tab === "details" && (
        <div className="space-y-3 px-3 pb-32">
          <Section title="O firmie" onEdit={() => setEditing(true)}>
            <Field label="Typ firmy">{company.company_type ? TYPE_LABEL[company.company_type] : "—"}</Field>
            <Field label="Roczny przychód">
              <span className="text-[26px] font-semibold tabular-nums">{formatPln(won)}</span>
              <span className="ml-2 text-[15px] m-muted">z {deals.length} dealów</span>
            </Field>
            {company.nip && <Field label="NIP">{company.nip}</Field>}
            {company.email && (
              <Field label="E-mail">
                <a className="m-link break-all" href={`mailto:${company.email}`}>
                  {company.email}
                </a>
              </Field>
            )}
            {company.phone && (
              <Field label="Telefon">
                <a className="m-link" href={`tel:${company.phone}`}>
                  {company.phone}
                </a>
              </Field>
            )}
            {company.address && <Field label="Adres">{company.address}</Field>}
            {company.comment && <Field label="Notatka">{company.comment}</Field>}
            <div className="py-3">
              <div className="rounded-xl border border-[#2c3340] px-3 py-3">
                <div className="m-label">Odpowiedzialny</div>
                <div className="mt-1 flex items-center gap-2 text-[19px] m-link">
                  <MAvatar name={personName(company.owner_id)} />
                  {personName(company.owner_id)}
                </div>
              </div>
            </div>
            <Field label="Utworzono">{formatLong(company.created_at)}</Field>
          </Section>
          <Section title="Kontakty" onEdit={() => setAddingContact(true)} footer={false}>
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <MAvatar name={`${c.first_name} ${c.last_name ?? ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[17px]">
                    {c.first_name} {c.last_name ?? ""}
                  </div>
                  <div className="text-[13px] m-muted">{[c.position, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="m-round h-9 w-9 m-round-on" aria-label="Zadzwoń">
                    <MIcon name="phone" className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
            {contacts.length === 0 && (
              <button type="button" className="flex items-center gap-2 py-3 text-[17px] m-link" onClick={() => setAddingContact(true)}>
                <MIcon name="plus" className="h-4 w-4" /> Dodaj kontakt
              </button>
            )}
          </Section>
        </div>
      )}
      {tab === "timeline" && <MobileTimeline entity="company" entityId={id} events={events} hint="Zaplanuj kolejny krok, żeby niczego nie przegapić" />}
      {tab === "deals" && (
        <div className="space-y-3 px-3 pt-1 pb-32">
          {deals.map((d) => (
            <DealMobileCard key={d.id} deal={d} onMenu={() => openRecord(`/deals/${d.id}`)} onStage={() => setStageFor(d)} />
          ))}
          {deals.length === 0 && <div className="m-card p-6 text-center m-muted">Brak dealów</div>}
          {stageFor && <StagePicker open onClose={() => setStageFor(null)} stages={data.stages} current={stageFor.stage_code} onPick={(code) => moveDeal(stageFor.id, code)} />}
        </div>
      )}
      <Sheet open={menu} onClose={() => setMenu(false)} title={company.name}>
        <SheetItem icon="pencil" onClick={() => (setEditing(true), setMenu(false))}>
          Edytuj
        </SheetItem>
        <SheetItem icon="person" onClick={() => (setAddingContact(true), setMenu(false))}>
          Dodaj kontakt
        </SheetItem>
        <SheetItem icon="trash" danger onClick={() => window.confirm(`Usunąć firmę ${company.name}?`) && deleteCompany(id).then(close).catch((e) => window.alert(e.message))}>
          Usuń firmę
        </SheetItem>
      </Sheet>
      {editing && <CompanyForm open onClose={() => setEditing(false)} initial={company} onSubmit={(v) => updateCompany(id, v)} />}
      {addingContact && <ContactForm open onClose={() => setAddingContact(false)} initial={{ ...emptyContact(), company_id: id }} onSubmit={async (v) => void (await createContact(v))} />}
    </div>
  );
}

/* ---------------------------------------------------------------- product */
export function MobileProduct({ id }: { id: number }) {
  const { data, repo, updateProduct, uploadProductImage, moveDeal } = useData();
  const close = useCloseSlider();
  const openRecord = useOpenRecord();
  const product = data.products.find((p) => p.id === id);
  const [tab, setTab] = useTabFromUrl("details");
  const [editing, setEditing] = useState(false);
  const [stageFor, setStageFor] = useState<Deal | null>(null);
  const lines = useMemo(() => data.deal_lines.filter((l) => l.product_id === id), [data.deal_lines, id]);
  const dealIds = useMemo(() => new Set(lines.map((l) => l.deal_id)), [lines]);
  const deals = useMemo(() => data.deals.filter((d) => dealIds.has(d.id)).sort((a, b) => b.id - a.id), [data.deals, dealIds]);
  useEffect(() => {
    if (product) document.title = `${product.name} · Browar Pogórza CRM`;
  }, [product]);
  if (!product) return <div className="p-6 m-muted">Nie ma takiego produktu.</div>;
  const img = repo.imageUrl(product.image_path);
  const sold = lines.reduce((s, l) => s + l.quantity, 0);
  const revenue = lines.reduce((s, l) => s + l.price * l.quantity * (1 - (l.discount_rate || 0) / 100) - (l.discount_sum || 0), 0);

  return (
    <div className="bxm min-h-full">
      <Header badge="box" color="#2f9e7a" title={product.name} subtitle={product.group_name ?? "Produkt"} onClose={close} right={<button type="button" className="px-3 py-2 text-[19px] m-link" onClick={() => setEditing(true)}>Edytuj</button>} />
      <Tabs tabs={[["details", "Szczegóły"], ["deals", `Deale (${deals.length})`]]} value={tab} onChange={setTab} />
      {tab === "details" && (
        <div className="space-y-3 px-3 pb-32">
          <Section title="Dane produktu" onEdit={() => setEditing(true)} footer={false}>
            <div className="py-3">
              {img ? (
                <img src={img} alt={product.name} className="h-48 w-48 rounded-xl object-cover" />
              ) : (
                <label className="flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-[#3a4150] text-[15px] m-muted">
                  + dodaj zdjęcie
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProductImage(id, e.target.files[0])} />
                </label>
              )}
            </div>
            <Field label="Cena">
              <span className="text-[26px] font-semibold tabular-nums">{formatPln(product.price)}</span>
              <span className="ml-2 text-[15px] m-muted">za {product.unit}</span>
            </Field>
            <Field label="Grupa">{product.group_name ?? "—"}</Field>
            <Field label="Aktywny">{product.active ? "Tak" : "Nie"}</Field>
            <Field label="Sprzedano łącznie">{sold} {product.unit}</Field>
            <Field label="Przychód łącznie">{formatPln(revenue)}</Field>
            <Field label="Utworzono">{formatLong(product.created_at)}</Field>
          </Section>
        </div>
      )}
      {tab === "deals" && (
        <div className="space-y-3 px-3 pt-1 pb-32">
          {deals.slice(0, 40).map((d) => (
            <DealMobileCard key={d.id} deal={d} onMenu={() => openRecord(`/deals/${d.id}`)} onStage={() => setStageFor(d)} />
          ))}
          {stageFor && <StagePicker open onClose={() => setStageFor(null)} stages={data.stages} current={stageFor.stage_code} onPick={(code) => moveDeal(stageFor.id, code)} />}
        </div>
      )}
      {editing && <ProductForm open onClose={() => setEditing(false)} initial={product} onSubmit={(v) => updateProduct(id, v)} onImage={(file) => uploadProductImage(id, file)} />}
    </div>
  );
}
