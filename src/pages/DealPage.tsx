import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { NewLine } from "@/types";
import { useData } from "@/store";
import { Field, Money, Toast } from "@/components/ui";
import { CompanyPicker } from "@/components/Pickers";
import LineEditor from "@/components/LineEditor";
import Timeline from "@/components/Timeline";
import { formatDate, formatDateTime } from "@/lib/dates";

export default function DealPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const navigate = useNavigate();
  const { data, companyById, contactById, personName, linesOf, moveDeal, updateDeal, setLines, deleteDeal } = useData();
  const deal = data.deals.find((d) => d.id === dealId);
  const saved = linesOf(dealId);
  const [lines, setLinesState] = useState<NewLine[]>(saved);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useMemo(() => data.stage_history.filter((h) => h.deal_id === dealId), [data.stage_history, dealId]);

  useEffect(() => {
    if (!editing) setLinesState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.deal_lines, editing]);

  if (!deal)
    return (
      <div className="p-6 text-muted">
        Nie ma takiego dealu. <Link to="/" className="text-sky-300">Wróć</Link>
      </div>
    );

  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
  const stage = data.stages.find((s) => s.code === deal.stage_code);
  const companyContacts = data.contacts.filter((c) => c.company_id === deal.company_id);

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

  const saveLines = () => run(async () => {
    await setLines(dealId, lines);
    setEditing(false);
  });

  const remove = () => {
    if (!window.confirm(`Usunąć ${deal.title}? Tej operacji nie da się cofnąć.`)) return;
    run(async () => {
      await deleteDeal(dealId);
      navigate("/");
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <Link to="/" className="text-xs text-muted">
            ← Deale
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {deal.title}
            {deal.repeat_customer && <span className="pill bg-panel-2 text-gray-300">powtarzalny</span>}
          </h1>
          <div className="text-sm text-muted">
            utworzono {formatDateTime(deal.created_at)} · {personName(deal.owner_id)}
          </div>
        </div>
        <Money value={deal.amount} className="text-2xl font-semibold" />
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-3">
        <Field label="Etap">
          <select className="input" value={deal.stage_code} disabled={busy} onChange={(e) => run(() => moveDeal(dealId, e.target.value))} style={{ borderColor: stage?.color }}>
            {data.stages.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Firma">
          <CompanyPicker value={deal.company_id} onChange={(cid) => run(() => updateDeal(dealId, { company_id: cid, contact_id: null }))} />
        </Field>
        <Field label="Kontakt">
          <select className="input" value={deal.contact_id ?? ""} disabled={busy || companyContacts.length === 0} onChange={(e) => run(() => updateDeal(dealId, { contact_id: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">{companyContacts.length ? "—" : "brak kontaktów firmy"}</option>
            {companyContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name ?? ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data rozpoczęcia">
          <input className="input" type="date" value={deal.begin_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { begin_date: e.target.value || null }))} />
        </Field>
        <Field label="Data zakończenia">
          <input className="input" type="date" value={deal.close_date ?? ""} disabled={busy} onChange={(e) => run(() => updateDeal(dealId, { close_date: e.target.value || null }))} />
        </Field>
        <Field label="Komentarz do dealu">
          <input className="input" defaultValue={deal.comment ?? ""} disabled={busy} onBlur={(e) => e.target.value !== (deal.comment ?? "") && run(() => updateDeal(dealId, { comment: e.target.value || null }))} />
        </Field>
        {company && (
          <div className="sm:col-span-3 text-sm text-muted">
            <Link to={`/companies/${company.id}`} className="text-sky-300">
              {company.name}
            </Link>
            {company.nip && ` · NIP ${company.nip}`}
            {company.email && ` · ${company.email}`}
            {company.phone && ` · ${company.phone}`}
            {contact && ` · ${contact.first_name} ${contact.last_name ?? ""}${contact.phone ? ` ${contact.phone}` : ""}`}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pozycje</h2>
          {editing ? (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => (setLinesState(saved), setEditing(false))}>
                Anuluj
              </button>
              <button type="button" className="btn-primary" disabled={busy} onClick={saveLines}>
                Zapisz pozycje
              </button>
            </div>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              Edytuj
            </button>
          )}
        </div>
        <LineEditor lines={editing ? lines : saved} onChange={setLinesState} readOnly={!editing} />
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Oś czasu</h2>
        <Timeline entity="deal" entityId={dealId} history={history} />
      </div>

      <div className="flex justify-between text-xs text-muted">
        <span>ostatnia zmiana {formatDate(deal.updated_at)}</span>
        <button type="button" className="text-red-400 hover:underline" onClick={remove}>
          Usuń deal
        </button>
      </div>
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
