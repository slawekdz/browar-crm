import { useMemo, useState, type FormEvent } from "react";
import type { CommentEntity, StageHistory } from "@/types";
import { useData } from "@/store";
import { Avatar } from "./ui";
import { formatDateTime } from "@/lib/dates";

type Entry =
  | { key: string; at: string; type: "comment"; id: number; author: string; body: string; kind: "comment" | "task"; completed: boolean; deadline: string | null; files: { name: string; url: string }[] }
  | { key: string; at: string; type: "stage"; stage: string; color: string; by: string };

export default function Timeline({ entity, entityId, history = [] }: { entity: CommentEntity; entityId: number; history?: StageHistory[] }) {
  const { commentsOf, personName, addComment, deleteComment, data } = useData();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const stageByCode = useMemo(() => new Map(data.stages.map((s) => [s.code, s])), [data.stages]);

  const entries = useMemo<Entry[]>(() => {
    const comments: Entry[] = commentsOf(entity, entityId).map((c) => ({
      key: `c${c.id}`,
      at: c.created_at,
      type: "comment",
      id: c.id,
      author: personName(c.author_id),
      body: c.body,
      kind: c.kind,
      completed: c.completed,
      deadline: c.deadline,
      files: c.files,
    }));
    const moves: Entry[] = history.map((h) => ({ key: `h${h.id}`, at: h.moved_at, type: "stage", stage: stageByCode.get(h.stage_code)?.name ?? h.stage_code, color: stageByCode.get(h.stage_code)?.color ?? "#94a3b8", by: personName(h.moved_by) }));
    return [...comments, ...moves].sort((a, b) => b.at.localeCompare(a.at));
  }, [commentsOf, entity, entityId, history, personName, stageByCode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addComment(entity, entityId, body.trim());
      setBody("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <textarea className="input min-h-10" rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dodaj komentarz…" aria-label="Komentarz" />
        <button type="submit" className="btn-primary self-end" disabled={busy || !body.trim()}>
          Dodaj
        </button>
      </form>
      <ol className="space-y-2">
        {entries.map((entry) =>
          entry.type === "stage" ? (
            <li key={entry.key} className="flex items-center gap-2 text-xs text-muted px-1">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
              <span>
                Etap: <span className="text-gray-200">{entry.stage}</span>
                {entry.by && ` · ${entry.by}`}
              </span>
              <span className="ml-auto">{formatDateTime(entry.at)}</span>
            </li>
          ) : (
            <li key={entry.key} className="card p-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar name={entry.author} size={5} />
                <span className="text-gray-300">{entry.author}</span>
                {entry.kind === "task" && <span className={`pill ${entry.completed ? "bg-emerald-900/60 text-emerald-300" : "bg-amber/20 text-amber"}`}>{entry.completed ? "zadanie wykonane" : "zadanie"}</span>}
                <span className="ml-auto">{formatDateTime(entry.at)}</span>
                <button type="button" className="text-muted hover:text-red-400" onClick={() => deleteComment(entry.id)} aria-label="Usuń wpis">
                  ✕
                </button>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{entry.body}</div>
              {entry.deadline && <div className="mt-1 text-xs text-muted">termin: {formatDateTime(entry.deadline)}</div>}
              {entry.files.length > 0 && <div className="mt-1 text-xs text-muted">załączniki w Bitrix: {entry.files.map((f) => f.name).join(", ")}</div>}
            </li>
          ),
        )}
        {entries.length === 0 && <li className="text-sm text-muted px-1">Brak wpisów</li>}
      </ol>
    </div>
  );
}
