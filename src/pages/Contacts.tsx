import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Contact, NewContact } from "@/types";
import { useData } from "@/store";
import { Field, Modal, SearchInput, Toast, matches } from "@/components/ui";
import { CompanyPicker } from "@/components/Pickers";

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
        {error && <div className="text-sm text-red-400">{error}</div>}
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
    <div className="mx-auto max-w-5xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold mr-auto">Kontakty</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
          + Kontakt
        </button>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Imię, nazwisko, telefon, firma" />
      <ul className="divide-y divide-line card">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {c.first_name} {c.last_name ?? ""}
                {c.position && <span className="text-muted font-normal"> · {c.position}</span>}
              </div>
              <div className="truncate text-xs text-muted">
                {[c.phone, c.email].filter(Boolean).join(" · ")}
                {c.company_id && (
                  <>
                    {" · "}
                    <Link to={`/companies/${c.company_id}`} className="text-sky-300">
                      {companyById.get(c.company_id)?.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <button type="button" className="btn-ghost py-1" onClick={() => setEditing(c)}>
              Edytuj
            </button>
            <button type="button" className="text-muted hover:text-red-400" onClick={() => remove(c)} aria-label="Usuń">
              ✕
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-6 text-sm text-muted text-center">Brak kontaktów</li>}
      </ul>
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
