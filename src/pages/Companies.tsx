import { useMemo, useState, type FormEvent } from "react";
import type { Company, NewCompany } from "@/types";
import { useData } from "@/store";
import { Field, Modal, Money, Toast, matches } from "@/components/ui";
import { RecordLink, useOpenRecord } from "@/lib/nav";
import { CURRENT_USER_ID } from "@/lib/db";
import { formatNumeric } from "@/lib/dates";

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
        {error && <div className="text-sm text-danger">{error}</div>}
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
  const { data, createCompany, personName } = useData();
  const openRecord = useOpenRecord();
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
    () => data.companies.filter((c) => matches(q, c.name, c.nip, c.email, c.phone, c.address)).sort((a, b) => (stats.get(b.id)?.last ?? "").localeCompare(stats.get(a.id)?.last ?? "") || a.name.localeCompare(b.name, "pl")),
    [data.companies, q, stats],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2 text-white space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold mr-1">Firmy</h1>
          <button type="button" className="btn-success py-1.5" onClick={() => setAdding(true)}>
            + Utwórz
          </button>
          <div className="flex-1 min-w-56 flex items-center rounded-lg bg-white/15 px-3 py-1 backdrop-blur focus-within:bg-white/25">
            <input className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-white/70 focus:outline-none" placeholder="Filtruj i szukaj" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nazwa, NIP, e-mail, telefon" />
          </div>
        </div>
        <div className="text-xs text-white/80">{list.length} firm</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ul className="sm:hidden space-y-2">
          {list.map((c) => {
            const s = stats.get(c.id);
            return (
              <li key={c.id}>
                <button type="button" className="w-full rounded-xl bg-white p-3 text-left shadow-sm active:bg-gray-50" onClick={() => openRecord(`/companies/${c.id}`)}>
                  <div className="font-medium text-link">{c.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{[c.nip && `NIP ${c.nip}`, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                    <span>{s ? `${s.count} dealów · ostatni ${formatNumeric(s.last)}` : "brak dealów"}</span>
                    {s && s.won > 0 && <Money value={s.won} className="font-medium text-ink" />}
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm">Brak firm</li>}
        </ul>
        <div className="hidden sm:block rounded-xl bg-white shadow-sm text-sm overflow-x-auto scroll-thin">
          <table className="w-full min-w-[760px]">
            <thead className="sticky top-0 bg-white border-b border-line">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Firma</th>
                <th className="px-3 py-2">NIP</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2 text-right">Deale</th>
                <th className="px-3 py-2 text-right">Wygrane</th>
                <th className="px-3 py-2">Ostatni deal</th>
                <th className="px-3 py-2">Odpowiedzialny</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-line/70 hover:bg-gray-50 cursor-pointer" onClick={() => openRecord(`/companies/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <RecordLink to={`/companies/${c.id}`} className="link font-medium" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </RecordLink>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{c.nip ?? ""}</td>
                    <td className="px-3 py-2.5 text-gray-600 truncate max-w-56">{c.email ?? ""}</td>
                    <td className="px-3 py-2.5 text-gray-600">{c.phone ?? ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s?.count ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s && s.won > 0 ? <Money value={s.won} /> : ""}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s ? formatNumeric(s.last) : ""}</td>
                    <td className="px-3 py-2.5 text-gray-600">{personName(c.owner_id)}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Brak firm
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {adding && (
        <CompanyForm
          open
          onClose={() => setAdding(false)}
          initial={emptyCompany()}
          onSubmit={async (values) => {
            const row = await createCompany(values);
            openRecord(`/companies/${row.id}`);
          }}
        />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
