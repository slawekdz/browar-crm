import { useMemo, useState, type FormEvent } from "react";
import type { Contact, NewContact } from "@/types";
import { useData } from "@/store";
import { Field, Modal, Toast, matches } from "@/components/ui";
import { CompanyPicker } from "@/components/Pickers";
import { RecordLink } from "@/lib/nav";

export const emptyContact = (): NewContact => ({ first_name: "", last_name: null, phone: null, email: null, position: null, company_id: null });
const nullable = (v: string): string | null => v.trim() || null;

export function ContactForm({ open, onClose, initial, onSubmit }: { open: boolean; onClose: () => void; initial: NewContact | Contact; onSubmit: (values: NewContact) => Promise<void> }) {
  const [values, setValues] = useState<NewContact>({ ...emptyContact(), ...initial });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof NewContact) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: key === "first_name" ? e.target.value : nullable(e.target.value) }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ ...values, first_name: values.first_name.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    }
  };
  return (
    <Modal title={"id" in initial ? "Edytuj kontakt" : "Nowy kontakt"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Imię">
            <input className="input" value={values.first_name} onChange={set("first_name")} required autoFocus />
          </Field>
          <Field label="Nazwisko">
            <input className="input" value={values.last_name ?? ""} onChange={set("last_name")} />
          </Field>
          <Field label="Telefon">
            <input className="input" type="tel" value={values.phone ?? ""} onChange={set("phone")} />
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={values.email ?? ""} onChange={set("email")} />
          </Field>
        </div>
        <Field label="Stanowisko">
          <input className="input" value={values.position ?? ""} onChange={set("position")} />
        </Field>
        <Field label="Firma">
          <CompanyPicker value={values.company_id} onChange={(id) => setValues((v) => ({ ...v, company_id: id }))} />
        </Field>
        {error && <div className="text-sm text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary">
            Zapisz
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Contacts() {
  const { data, companyById, createContact, updateContact, deleteContact } = useData();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(
    () => data.contacts.filter((c) => matches(q, c.first_name, c.last_name, c.phone, c.email, c.company_id ? companyById.get(c.company_id)?.name : "")).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "pl")),
    [data.contacts, q, companyById],
  );
  const remove = async (c: Contact) => {
    if (!window.confirm(`Usunąć kontakt ${c.first_name} ${c.last_name ?? ""}?`)) return;
    try {
      await deleteContact(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie można usunąć");
    }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2 text-white space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold mr-1">Kontakty</h1>
          <button type="button" className="btn-success py-1.5" onClick={() => setEditing("new")}>
            + Utwórz
          </button>
          <div className="flex-1 min-w-56 flex items-center rounded-lg bg-white/15 px-3 py-1 backdrop-blur focus-within:bg-white/25">
            <input className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-white/70 focus:outline-none" placeholder="Filtruj i szukaj" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Imię, nazwisko, telefon, firma" />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="rounded-xl bg-white shadow-sm text-sm overflow-x-auto scroll-thin">
          <table className="w-full min-w-[700px]">
            <thead className="sticky top-0 bg-white border-b border-line">
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Kontakt</th>
                <th className="px-3 py-2">Stanowisko</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-line/70 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">
                    {c.first_name} {c.last_name ?? ""}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{c.position ?? ""}</td>
                  <td className="px-3 py-2.5">{c.phone && <a className="link" href={`tel:${c.phone}`}>{c.phone}</a>}</td>
                  <td className="px-3 py-2.5">{c.email && <a className="link" href={`mailto:${c.email}`}>{c.email}</a>}</td>
                  <td className="px-3 py-2.5">
                    {c.company_id && (
                      <RecordLink to={`/companies/${c.company_id}`} className="link">
                        {companyById.get(c.company_id)?.name}
                      </RecordLink>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button type="button" className="text-gray-500 hover:text-link mr-3" onClick={() => setEditing(c)}>
                      Edytuj
                    </button>
                    <button type="button" className="text-gray-400 hover:text-danger" onClick={() => remove(c)} aria-label="Usuń">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Brak kontaktów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <ContactForm
          open
          onClose={() => setEditing(null)}
          initial={editing === "new" ? emptyContact() : editing}
          onSubmit={async (v) => {
            if (editing === "new") await createContact(v);
            else await updateContact(editing.id, v);
          }}
        />
      )}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
