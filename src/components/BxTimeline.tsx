import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Comment, CommentEntity } from "@/types";
import { RecordLink } from "@/lib/nav";
import { useData } from "@/store";
import { formatDateTime, today } from "@/lib/dates";

/*
 * Bitrix24-style timeline shared by the company and deal cards: activity/comment composer,
 * "Do zrobienia" block with open tasks, pinned entries, date separators, and entity events
 * (deal created / stage changed / deal closed) supplied by the page.
 */

export interface TimelineEvent {
  key: string;
  at: string;
  title: string;
  icon: "up" | "deal" | "info" | "stage";
  pills?: { text: string; tone: "won" | "lost" | "grey"; color?: string }[];
  arrow?: [string, string];
  link?: { to: string; label: string };
  suffix?: string;
  ownerId: number | null;
}

type Entry = { key: string; at: string; type: "comment"; comment: Comment } | { key: string; at: string; type: "event"; event: TimelineEvent };

const PAGE = 30;
const dayKey = (iso: string): string => iso.slice(0, 10);
const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const isToday = (day: string): boolean => day === new Date().toISOString().slice(0, 10) || day === dayKey(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString());
const dayLabel = (day: string): string => {
  if (isToday(day)) return "Dzisiaj";
  const d = new Date(`${day}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("pl-PL", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }) + (sameYear ? "" : " r.");
};
const initials = (name: string): string =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

export function Icon({ kind }: { kind: "chat" | "up" | "plus" | "info" | "task" | "deal" | "stage" }) {
  const paths: Record<string, ReactNode> = {
    chat: <path d="M4 5h16v10H8l-4 4V5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    up: <path d="M12 19V6m0 0l-5 5m5-5l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    plus: <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />,
    info: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></>,
    task: <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
    deal: <path d="M4 7h16v12H4zM4 11h16M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
    stage: <path d="M5 6h11l3 6-3 6H5l3-6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      {paths[kind]}
    </svg>
  );
}

export function Rail({ icon, tone = "blue", children }: { icon: "chat" | "up" | "plus" | "info" | "task" | "deal" | "stage"; tone?: "blue" | "green" | "grey"; children: ReactNode }) {
  const bg = { blue: "bg-[#2fc6f6] text-white", green: "bg-[#9dcf00] text-white", grey: "bg-white text-gray-400 border border-gray-300" }[tone];
  return (
    <div className="relative pl-14">
      <span className={`absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-full ${bg} shadow-sm`}>
        <Icon kind={icon} />
      </span>
      {children}
    </div>
  );
}

const Avatar = ({ name }: { name: string }) => (
  <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700" title={name}>
    {initials(name)}
  </span>
);

export default function BxTimeline({ entity, entityId, events, taskHint }: { entity: CommentEntity; entityId: number; events: TimelineEvent[]; taskHint: string }) {
  const { commentsOf, personName, addComment, updateComment, deleteComment } = useData();
  const [composer, setComposer] = useState<"task" | "comment">("task");
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState(today());
  const [editId, setEditId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);

  const comments = commentsOf(entity, entityId);
  const openTasks = comments.filter((c) => c.kind === "task" && !c.completed);
  const pinned = comments.filter((c) => c.pinned && !(c.kind === "task" && !c.completed));

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = events.map((e) => ({ key: e.key, at: e.at, type: "event", event: e }));
    for (const c of comments) if (!(c.kind === "task" && !c.completed) && !c.pinned) list.push({ key: `m${c.id}`, at: c.created_at, type: "comment", comment: c });
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [events, comments]);

  const grouped = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    for (const e of entries.slice(0, limit)) {
      const day = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [entries, limit]);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    run(async () => {
      await addComment(entity, entityId, composer === "task" ? { kind: "task", body, deadline: `${deadline}T18:00:00` } : { kind: "comment", body, deadline: null });
      setDraft("");
    });
  };

  const commentCard = (c: Comment, showPinned = false) => (
    <Rail key={c.id} icon={c.kind === "task" ? "task" : "chat"} tone={c.kind === "task" && c.completed ? "green" : "blue"}>
      <article className="rounded-xl bg-white shadow-sm p-4">
        <header className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-800">{c.kind === "task" ? (c.completed ? "Zadanie wykonane" : "Zadanie") : "Komentarz"}</span>
          {showPinned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">przypięte</span>}
          <span className="text-gray-400">{timeOf(c.created_at)}</span>
          <Avatar name={personName(c.author_id)} />
        </header>
        <div className="mt-3 flex gap-3">
          <div className="hidden sm:flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-[#e8f7fd] text-[#2fc6f6]">
            <Icon kind={c.kind === "task" ? "task" : "chat"} />
          </div>
          <div className="flex-1 min-w-0">
            {editId === c.id ? (
              <div className="space-y-2">
                <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2fc6f6]" rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[#2fc6f6] px-3 py-1.5 text-sm font-medium text-white"
                    onClick={() =>
                      run(async () => {
                        if (editBody.trim() && editBody.trim() !== c.body) await updateComment(c.id, { body: editBody.trim() });
                        setEditId(null);
                      })
                    }
                  >
                    Zapisz
                  </button>
                  <button type="button" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" onClick={() => setEditId(null)}>
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap">
                <span className="flex-1">{c.body}</span>
                <button type="button" className="text-gray-300 hover:text-gray-600" title="Edytuj" aria-label="Edytuj wpis" onClick={() => (setEditId(c.id), setEditBody(c.body))}>
                  ✎
                </button>
              </div>
            )}
            {c.deadline && <div className="mt-1 text-xs text-gray-500">termin: {formatDateTime(c.deadline)}</div>}
            {c.files.length > 0 && <div className="mt-1 text-xs text-gray-500">załączniki (Bitrix): {c.files.map((f) => f.name).join(", ")}</div>}
          </div>
        </div>
        <footer className="mt-3 flex items-center gap-2">
          {c.kind === "task" && !c.completed ? (
            <button type="button" className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50" onClick={() => run(() => updateComment(c.id, { completed: true }))}>
              Wykonane
            </button>
          ) : (
            <button type="button" className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50" onClick={() => run(() => updateComment(c.id, { pinned: !c.pinned }))}>
              {c.pinned ? "Odepnij" : "Przypnij"}
            </button>
          )}
          <button type="button" className="ml-auto text-gray-400 hover:text-red-500 text-sm" onClick={() => window.confirm("Usunąć wpis?") && run(() => deleteComment(c.id))} aria-label="Usuń wpis">
            Usuń
          </button>
        </footer>
      </article>
    </Rail>
  );

  const pill = (p: NonNullable<TimelineEvent["pills"]>[number]) => {
    if (p.color) return <span key={p.text} className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: p.color }}>{p.text}</span>;
    const cls = { won: "bg-[#dff3c2] text-[#4a6b00]", lost: "bg-red-100 text-red-700", grey: "bg-gray-100 text-gray-600" }[p.tone];
    return (
      <span key={p.text} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
        {p.text}
      </span>
    );
  };

  const eventCard = (e: TimelineEvent) => (
    <Rail key={e.key} icon={e.icon} tone="grey">
      <article className="rounded-xl bg-white shadow-sm p-4 text-sm">
        <header className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-500">{e.title}</span>
          {e.pills?.map(pill)}
          <span className="text-gray-400">{timeOf(e.at)}</span>
          <Avatar name={personName(e.ownerId)} />
        </header>
        {(e.arrow || e.link) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-gray-700">
            {e.arrow && (
              <>
                <span className="rounded-md bg-gray-100 px-2.5 py-1 text-gray-700">{e.arrow[0]}</span>
                <span className="text-gray-400">→</span>
                <span className="rounded-md bg-gray-100 px-2.5 py-1 text-gray-700">{e.arrow[1]}</span>
              </>
            )}
            {e.link && (
              <span>
                {e.link.to.startsWith("/deals") ? "Deal " : ""}
                <RecordLink to={e.link.to} className="text-[#0b66c3] hover:underline">
                  {e.link.label}
                </RecordLink>
                {e.suffix && <span className="text-gray-500"> · {e.suffix}</span>}
              </span>
            )}
          </div>
        )}
      </article>
    </Rail>
  );

  return (
    <section className="space-y-4 relative">
      <div className="absolute left-[18px] top-4 bottom-4 w-px bg-gray-300 hidden sm:block" aria-hidden />
      <Rail icon="chat">
        <form onSubmit={submit} className="rounded-xl bg-white shadow-sm p-4">
          <div className="flex gap-1 text-[15px]">
            <button type="button" className={`rounded-lg px-3 py-1.5 ${composer === "task" ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600"}`} onClick={() => setComposer("task")}>
              Aktywność
            </button>
            <button type="button" className={`rounded-lg px-3 py-1.5 ${composer === "comment" ? "bg-[#e8f7fd] text-[#0b66c3] font-medium" : "text-gray-600"}`} onClick={() => setComposer("comment")}>
              Komentarz
            </button>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-300 px-4 py-1 focus-within:ring-2 focus-within:ring-[#2fc6f6]">
              <textarea
                className="flex-1 resize-none bg-transparent py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                rows={draft.includes("\n") || draft.length > 60 ? 3 : 1}
                placeholder={composer === "task" ? "Do zrobienia" : "Zostaw komentarz"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={composer === "task" ? "Do zrobienia" : "Komentarz"}
                data-composer
              />
              {composer === "task" && (
                <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500" title="Termin">
                  akcje ▾
                  <input type="date" className="w-32 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Termin" />
                </label>
              )}
            </div>
            <button type="submit" className="rounded-xl bg-[#2fc6f6] px-4 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={!draft.trim()}>
              {composer === "task" ? "Zaplanuj" : "Wyślij"}
            </button>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </form>
      </Rail>

      <div className="flex justify-center">
        <span className="rounded-full bg-[#9dcf00] px-4 py-1 text-xs font-semibold text-white">Do zrobienia</span>
      </div>
      {openTasks.length === 0 ? (
        <Rail icon="info" tone="green">
          <button type="button" className="w-full text-left rounded-xl bg-[#fff8dc] p-4 flex items-center gap-3" onClick={() => (setComposer("task"), document.querySelector<HTMLTextAreaElement>("textarea[data-composer]")?.focus())}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9dcf00] text-white">
              <Icon kind="plus" />
            </span>
            <span>
              <span className="block font-medium text-gray-900">Dodaj nową aktywność</span>
              <span className="block text-sm text-gray-500">{taskHint}</span>
            </span>
          </button>
        </Rail>
      ) : (
        openTasks.map((c) => commentCard(c))
      )}
      {pinned.map((c) => commentCard(c, true))}

      {grouped.map((group) => (
        <div key={group.day} className="space-y-4">
          <div className="flex justify-center">
            <span className={`rounded-full px-4 py-1 text-xs font-medium ${isToday(group.day) ? "bg-[#2fc6f6] text-white" : "bg-gray-200 text-gray-600"}`}>{dayLabel(group.day)}</span>
          </div>
          {group.items.map((e) => (e.type === "comment" ? commentCard(e.comment) : eventCard(e.event)))}
        </div>
      ))}
      {entries.length > limit && (
        <div className="flex justify-center">
          <button type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setLimit((l) => l + PAGE)}>
            Pokaż więcej ({entries.length - limit})
          </button>
        </div>
      )}
    </section>
  );
}
