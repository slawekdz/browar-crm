import { useMemo, useState } from "react";
import type { Company, Contact, Product } from "@/types";
import { useData } from "@/store";
import { useOpenRecord } from "@/lib/nav";
import { formatDateTime, formatLong } from "@/lib/dates";
import { formatPln } from "@/lib/money";
import { IconRail, MAvatar, MIcon, Sheet, SheetItem } from "./ui";
import { matches } from "@/components/ui";

/* Bitrix24 mobile list cards for contacts, companies and products: title, date, responsible, created, icon rail. */

function EntityCard({ title, subtitle, ownerName, created, count, phone, email, onOpen, onMenu, extra }: { title: string; subtitle: string; ownerName: string; created: string; count: number; phone: string | null | undefined; email: string | null | undefined; onOpen: () => void; onMenu: () => void; extra?: React.ReactNode }) {
  return (
    <article className="m-card px-4 py-4">
      <header className="flex items-start justify-between">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <div className="text-[22px] font-semibold leading-tight">{title}</div>
          <div className="mt-1 text-[15px] m-muted">{subtitle}</div>
        </button>
        <button type="button" className="p-2 m-muted" onClick={onMenu} aria-label={`Menu ${title}`}>
          <MIcon name="more" className="h-6 w-6" strokeWidth={3} />
        </button>
      </header>
      <div className="mt-3 flex gap-3">
        <button type="button" className="min-w-0 flex-1 space-y-4 text-left" onClick={onOpen}>
          <div>
            <div className="m-label">Osoba odpowiedzialna</div>
            <div className="mt-1 flex items-center gap-2 text-[19px] m-link">
              <MAvatar name={ownerName} />
              {ownerName}
            </div>
          </div>
          <div>
            <div className="m-label">Utworzono</div>
            <div className="text-[19px]">{created}</div>
          </div>
          {extra}
        </button>
        <IconRail count={count} phone={phone} email={email} onTimeline={onOpen} />
      </div>
    </article>
  );
}

export function MobileCompanies({ query }: { query: string }) {
  const { data, personName, commentsOf, deleteCompany } = useData();
  const openRecord = useOpenRecord();
  const [menuFor, setMenuFor] = useState<Company | null>(null);
  const list = useMemo(() => data.companies.filter((c) => matches(query, c.name, c.nip, c.email, c.phone)).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.companies, query]);
  return (
    <div className="space-y-3 px-3 pt-3 pb-28">
      {list.slice(0, 80).map((c) => (
        <EntityCard
          key={c.id}
          title={c.name}
          subtitle={formatLong(c.created_at)}
          ownerName={personName(c.owner_id)}
          created={formatDateTime(c.created_at)}
          count={commentsOf("company", c.id).length + data.deals.filter((d) => d.company_id === c.id).length}
          phone={c.phone}
          email={c.email}
          onOpen={() => openRecord(`/companies/${c.id}`)}
          onMenu={() => setMenuFor(c)}
        />
      ))}
      {list.length === 0 && <div className="m-card p-6 text-center m-muted">Brak firm</div>}
      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        {menuFor && (
          <>
            <SheetItem icon="pencil" onClick={() => (openRecord(`/companies/${menuFor.id}`), setMenuFor(null))}>
              Edytuj
            </SheetItem>
            <SheetItem icon="deal" onClick={() => (openRecord(`/companies/${menuFor.id}?tab=deals`), setMenuFor(null))}>
              Deale firmy
            </SheetItem>
            <SheetItem icon="trash" danger onClick={() => window.confirm(`Usunąć firmę ${menuFor.name}?`) && (deleteCompany(menuFor.id).catch(() => undefined), setMenuFor(null))}>
              Usuń
            </SheetItem>
          </>
        )}
      </Sheet>
    </div>
  );
}

export function MobileContacts({ query }: { query: string }) {
  const { data, personName, commentsOf, companyById, deleteContact } = useData();
  const openRecord = useOpenRecord();
  const [menuFor, setMenuFor] = useState<Contact | null>(null);
  const list = useMemo(() => data.contacts.filter((c) => matches(query, c.first_name, c.last_name, c.phone, c.email)).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.contacts, query]);
  return (
    <div className="space-y-3 px-3 pt-3 pb-28">
      {list.map((c) => (
        <EntityCard
          key={c.id}
          title={`${c.first_name} ${c.last_name ?? ""}`.trim()}
          subtitle={formatLong(c.created_at)}
          ownerName={personName(1)}
          created={formatDateTime(c.created_at)}
          count={commentsOf("contact", c.id).length}
          phone={c.phone}
          email={c.email}
          onOpen={() => (c.company_id ? openRecord(`/companies/${c.company_id}`) : setMenuFor(c))}
          onMenu={() => setMenuFor(c)}
          extra={
            c.company_id ? (
              <div>
                <div className="m-label">Firma</div>
                <div className="text-[19px] m-link">{companyById.get(c.company_id)?.name}</div>
              </div>
            ) : undefined
          }
        />
      ))}
      {list.length === 0 && <div className="m-card p-6 text-center m-muted">Brak kontaktów</div>}
      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor ? `${menuFor.first_name} ${menuFor.last_name ?? ""}` : undefined}>
        {menuFor && (
          <>
            {menuFor.phone && (
              <SheetItem icon="phone" onClick={() => (window.location.href = `tel:${menuFor.phone}`)}>
                Zadzwoń {menuFor.phone}
              </SheetItem>
            )}
            {menuFor.email && (
              <SheetItem icon="mail" onClick={() => (window.location.href = `mailto:${menuFor.email}`)}>
                Napisz {menuFor.email}
              </SheetItem>
            )}
            {menuFor.company_id && (
              <SheetItem icon="building" onClick={() => (openRecord(`/companies/${menuFor.company_id}`), setMenuFor(null))}>
                Otwórz firmę
              </SheetItem>
            )}
            <SheetItem icon="trash" danger onClick={() => window.confirm("Usunąć kontakt?") && (deleteContact(menuFor.id).catch(() => undefined), setMenuFor(null))}>
              Usuń
            </SheetItem>
          </>
        )}
      </Sheet>
    </div>
  );
}

export function MobileProducts({ query }: { query: string }) {
  const { data, repo } = useData();
  const openRecord = useOpenRecord();
  const sold = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of data.deal_lines) if (l.product_id) map.set(l.product_id, (map.get(l.product_id) ?? 0) + l.quantity);
    return map;
  }, [data.deal_lines]);
  const list = useMemo(() => data.products.filter((p) => p.active && matches(query, p.name, p.group_name)).sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0)), [data.products, query, sold]);
  const tile = (p: Product) => {
    const img = repo.imageUrl(p.image_path);
    return (
      <button key={p.id} type="button" className="m-card flex items-center gap-3 px-3 py-3 text-left" onClick={() => openRecord(`/products/${p.id}`)}>
        {img ? <img src={img} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" /> : <span className="flex h-16 w-16 items-center justify-center rounded-lg" style={{ background: "var(--m-card-2)" }}><MIcon name="box" className="h-7 w-7 m-muted" /></span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] font-semibold leading-tight">{p.name}</span>
          <span className="block text-[13px] m-muted">{p.group_name}{sold.get(p.id) ? ` · sprzedano ${sold.get(p.id)}` : ""}</span>
        </span>
        <span className="text-[19px] tabular-nums">{formatPln(p.price)}</span>
      </button>
    );
  };
  return (
    <div className="space-y-2 px-3 pt-3 pb-28">
      {list.map(tile)}
      {list.length === 0 && <div className="m-card p-6 text-center m-muted">Brak produktów</div>}
    </div>
  );
}
