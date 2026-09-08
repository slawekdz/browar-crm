import { useState, type FormEvent } from "react";
import { useData } from "@/store";
import { Field } from "@/components/ui";
import { resetLocalData } from "@/lib/local";

export default function Settings() {
  const { repo, auth, data, signOut, reload } = useData();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await repo.changePassword(password);
      setPassword("");
      setMessage("Hasło zmienione");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Błąd");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `browar-crm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2 text-white">
        <h1 className="text-2xl font-semibold">Ustawienia</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-lg space-y-4">
          <div className="card p-4 space-y-1 text-sm">
            <div>
              Konto: <span className="font-medium">{auth?.email}</span>
            </div>
            <div>
              Backend: <span className="font-medium">{repo.mode === "supabase" ? "Supabase" : "lokalny (dane w tej przeglądarce)"}</span>
            </div>
            <div className="text-muted">
              {data.deals.length} dealów · {data.companies.length} firm · {data.products.length} produktów · {data.comments.length} wpisów
            </div>
          </div>
          {repo.mode === "supabase" && (
            <form onSubmit={changePassword} className="card p-4 space-y-3">
              <Field label="Nowe hasło">
                <input className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <button type="submit" className="btn-primary">
                Zmień hasło
              </button>
            </form>
          )}
          <div className="card p-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={exportJson}>
              Eksport JSON
            </button>
            <button type="button" className="btn-ghost" onClick={reload}>
              Odśwież dane
            </button>
            {repo.mode === "local" && (
              <button type="button" className="btn-ghost" onClick={() => (resetLocalData(), reload())}>
                Przywróć dane z migracji
              </button>
            )}
            <button type="button" className="btn-danger ml-auto" onClick={signOut}>
              Wyloguj
            </button>
          </div>
          {message && <div className="text-sm text-link">{message}</div>}
        </div>
      </div>
    </div>
  );
}
