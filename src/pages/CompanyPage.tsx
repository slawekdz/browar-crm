import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "@/store";
import { Money, Toast } from "@/components/ui";
import { CompanyForm } from "./Companies";
import { ContactForm, emptyContact } from "./Contacts";
import DealForm from "@/components/DealForm";
import Timeline from "@/components/Timeline";
import { formatDate } from "@/lib/dates";

export default function CompanyPage() {
  const { id } = useParams();
  const companyId = Number(id);
  const navigate = useNavigate();
  const { data, updateCompany, deleteCompany, createContact, personName } = useData();
  const company = data.companies.find((c) => c.id === companyId);
  const [editing, setEditing] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deals = useMemo(() => data.deals.filter((d) => d.company_id === companyId).sort((a, b) => b.id - a.id), [data.deals, companyId]);
  const contacts = data.contacts.filter((c) => c.company_id === companyId);
  const won = deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);
  const stageByCode = new Map(data.stages.map((s) => [s.code, s]));

  if (!company)
    return (
      <div className="p-6 text-muted">
        Nie ma takiej firmy. <Link to="/companies" className="text-sky-300">Wróć</Link>
      </div>
    );

  const remove = async () => {
    if (!window.confirm(`Usunąć firmę ${company.name}?`)) return;
    try {
      await deleteCompany(companyId);
      navigate("/companies");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie można usunąć");
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0">
          <Link to="/companies" className="text-xs text-muted">
            ← Firmy
          </Link>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <div className="text-sm text-muted">
            {[company.nip && `NIP ${company.nip}`, company.email, company.phone, company.address].filter(Boolean).join(" · ")}
          </div>
          <div className="text-xs text-muted">opiekun {personName(company.owner_id)} · od {formatDate(company.created_at)}</div>
          {company.comment && <div className="mt-1 text-sm whitespace-pre-wrap">{company.comment}</div>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            Edytuj
          </button>
          <button type="button" className="btn-primary" onClick={() => setAddingDeal(true)}>
            + Deal
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-3">
          <div className="label">Dealów</div>
          <div className="text-lg font-semibold">{deals.length}</div>
        </div>
        <div className="card p-3">
          <div className="label">Wygrane łącznie</div>
          <Money value={won} className="text-lg font-semibold" />
        </div>
        <div className="card p-3">
          <div className="label">Ostatni deal</div>
          <div className="text-lg font-semibold">{deals[0] ? formatDate(deals[0].begin_date ?? deals[0].created_at) : "—"}</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="font-semibold">Kontakty</h2>
          <button type="button" className="btn-ghost py-1" onClick={() => setAddingContact(true)}>
            + Kontakt
          </button>
        </div>
        <ul className="divide-y divide-line">
          {contacts.map((c) => (
            <li key={c.id} className="px-4 py-2 text-sm flex flex-wrap gap-x-3">
              <span className="font-medium">
                {c.first_name} {c.last_name ?? ""}
              </span>
              <span className="text-muted">{[c.position, c.phone, c.email].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
          {contacts.length === 0 && <li className="px-4 py-3 text-sm text-muted">Brak kontaktów</li>}
        </ul>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-line font-semibold">Historia dealów</div>
        <ul className="divide-y divide-line">
          {deals.map((d) => {
            const stage = stageByCode.get(d.stage_code);
            return (
              <li key={d.id}>
                <Link to={`/deals/${d.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-panel-2">
                  <span className="w-24 shrink-0 text-sky-300">{d.title}</span>
                  <span className="pill text-ink shrink-0" style={{ background: stage?.color }}>
                    {stage?.name}
                  </span>
                  <span className="text-muted ml-auto shrink-0">{formatDate(d.begin_date ?? d.created_at)}</span>
                  <Money value={d.amount} className="w-24 text-right shrink-0" />
                </Link>
              </li>
            );
          })}
          {deals.length === 0 && <li className="px-4 py-3 text-sm text-muted">Brak dealów</li>}
        </ul>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Oś czasu</h2>
        <Timeline entity="company" entityId={companyId} />
      </div>

      <div className="text-right text-xs">
        <button type="button" className="text-red-400 hover:underline" onClick={remove}>
          Usuń firmę
        </button>
      </div>

      {editing && <CompanyForm open onClose={() => setEditing(false)} initial={company} onSubmit={(values) => updateCompany(companyId, values)} />}
      {addingDeal && <DealForm open onClose={() => setAddingDeal(false)} stage={null} companyId={companyId} onError={setError} />}
      {addingContact && (
        <ContactForm open onClose={() => setAddingContact(false)} initial={{ ...emptyContact(), company_id: companyId }} onSubmit={async (v) => void (await createContact(v))} />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
