import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Company, NewCompany } from "@/types";
import { useData } from "@/store";
import { Field, Modal, Money, SearchInput, Toast, matches } from "@/components/ui";
import { CURRENT_USER_ID } from "@/lib/db";

export const emptyCompany = (): NewCompany => ({ name: "", nip: null, email: null, phone: null, address: null, company_type: "CUSTOMER", comment: null, owner_id: CURRENT_USER_ID });

const nullable = (v: string): string | null => v.trim() || null;

export function CompanyForm({ open, onClose, initial, onSubmit }: { open: boolean; onClose: () => void; initial: NewCompany | Company; onSubmit: (values: NewCompany) => Promise<void> }) {
  const [values, setValues] = useState<NewCompany>({ ...emptyCompany(), ...initial });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof NewCompany) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: key === "name" ? e.target.value : nullable(e.target.value) }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (values.nip && !/^\d{10}$/.test(values.nip)) {
      setError("NIP to 10 cyfr");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={"id" in initial ? "Edytuj firmę" : "Nowa firma"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nazwa">
          <input className="input" value={values.name} onChange={set("name")} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="NIP">
            <input className="input" inputMode="numeric" value={values.nip ?? ""} onChange={set("nip")} />
          </Field>
          <Field label="Typ">
            <select className="input" value={values.company_type ?? ""} onChange={(e) => setValues((v) => ({ ...v, company_type: e.target.value || null }))}>
              <option value="CUSTOMER">Klient</option>
              <option value="SUPPLIER">Dostawca</option>
              <option value="PARTNER">Partner</option>
              <option value="OTHER">Inne</option>
            </select>
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={values.email ?? ""} onChange={set("email")} />
          </Field>
          <Field label="Telefon">
            <input className="input" type="tel" value={values.phone ?? ""} onChange={set("phone")} />
          </Field>
        </div>
        <Field label="Adres">
          <input className="input" value={values.address ?? ""} onChange={set("address")} />
        </Field>
        <Field label="Notatka">
          <textarea className="input" rows={2} value={values.comment ?? ""} onChange={set("comment")} />
        </Field>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Zapisz
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Companies() {
  const { data, createCompany } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const map = new Map<number, { count: number; won: number; last: string }>();
    for (const d of data.deals) {
      if (!d.company_id) continue;
      const s = map.get(d.company_id) ?? { count: 0, won: 0, last: "" };
      s.count += 1;
      if (d.stage_code === "WON") s.won += d.amount;
      const at = d.begin_date ?? d.created_at;
      if (at > s.last) s.last = at;
      map.set(d.company_id, s);
    }
    return map;
  }, [data.deals]);

  const list = useMemo(
    () =>
      data.companies
        .filter((c) => matches(q, c.name, c.nip, c.email, c.phone, c.address))
        .sort((a, b) => (stats.get(b.id)?.last ?? "").localeCompare(stats.get(a.id)?.last ?? "") || a.name.localeCompare(b.name, "pl")),
    [data.companies, q, stats],
  );

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold mr-auto">Firmy</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          + Firma
        </button>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Nazwa, NIP, e-mail, telefon" />
      <div className="text-xs text-muted">{list.length} firm</div>
      <ul className="divide-y divide-line card">
        {list.map((c) => {
          const s = stats.get(c.id);
          return (
            <li key={c.id}>
              <Link to={`/companies/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted">{[c.nip && `NIP ${c.nip}`, c.email, c.phone].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>{s ? `${s.count} dealów` : "brak dealów"}</div>
                  {s && s.won > 0 && <Money value={s.won} className="text-gray-200" />}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {adding && (
        <CompanyForm
          open
          onClose={() => setAdding(false)}
          initial={emptyCompany()}
          onSubmit={async (values) => {
            const row = await createCompany(values);
            navigate(`/companies/${row.id}`);
          }}
        />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
