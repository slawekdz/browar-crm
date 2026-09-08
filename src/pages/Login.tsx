import { useState, type FormEvent } from "react";
import { useStore } from "@/store";
import { Field } from "@/components/ui";

export default function Login() {
  const { signIn, repo } = useStore();
  const [email, setEmail] = useState("slawek@browarpogorza.pl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logowanie nie powiodło się");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6 wallpaper">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Browar Pogórza CRM</h1>
          <p className="text-xs text-muted">{repo.mode === "local" ? "Tryb lokalny: dowolne hasło" : "Zaloguj się swoim kontem"}</p>
        </div>
        <Field label="E-mail">
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Hasło">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required={repo.mode !== "local"} />
        </Field>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Logowanie…" : "Zaloguj"}
        </button>
      </form>
    </div>
  );
}
