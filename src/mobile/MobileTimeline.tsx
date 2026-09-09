import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment, CommentEntity } from "@/types";
import { useData } from "@/store";
import type { TimelineEvent } from "@/components/BxTimeline";
import { useOpenRecord } from "@/lib/nav";
import { today } from "@/lib/dates";
import { MAvatar, MIcon } from "./ui";

/*
 * Bitrix24 mobile timeline: green "Rzeczy do zrobienia" pill, olive "Utwórz aktywność" card,
 * grey date pills, dark entry cards ("Zmieniono etap" with arrow chips, "Utworzono deal"),
 * comments, and a composer that opens from the yellow card or the "+" button.
 */
type Entry = { key: string; at: string; type: "comment"; comment: Comment } | { key: string; at: string; type: "event"; event: TimelineEvent };
const dayKey = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (day: string) => {
  const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (day === todayKey) return "Dzisiaj";
  const d = new Date(`${day}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("pl-PL", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }) + (sameYear ? "" : " r.");
};

export default function MobileTimeline({ entity, entityId, events, hint, composeOnMount = false }: { entity: CommentEntity; entityId: number; events: TimelineEvent[]; hint: string; composeOnMount?: boolean }) {
  const { commentsOf, personName, addComment, updateComment, deleteComment } = useData();
  const openRecord = useOpenRecord();
  const [composer, setComposer] = useState<"task" | "comment" | null>(composeOnMount ? "task" : null);
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (composer) box.current?.focus();
  }, [composer]);

  const comments = commentsOf(entity, entityId);
  const openTasks = comments.filter((c) => c.kind === "task" && !c.completed);
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = events.map((e) => ({ key: e.key, at: e.at, type: "event", event: e }));
    for (const c of comments) if (!(c.kind === "task" && !c.completed)) list.push({ key: `m${c.id}`, at: c.created_at, type: "comment", comment: c });
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [events, comments]);
  const grouped = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    for (const e of entries.slice(0, 40)) {
      const day = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [entries]);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    }
  };
  const submit = () => {
    const body = draft.trim();
    if (!body || !composer) return;
    run(async () => {
      await addComment(entity, entityId, composer === "task" ? { kind: "task", body, deadline: `${deadline}T18:00:00` } : { kind: "comment", body, deadline: null });
      setDraft("");
      setComposer(null);
    });
  };

  const chip = (text: string, tone?: "won" | "lost" | "grey") => (
    <span key={text} className={`rounded-lg px-3 py-1 text-[15px] ${tone === "won" ? "bg-[#7cd44a] text-[#0c1b2a]" : tone === "lost" ? "bg-[#f0455a] text-white" : ""}`} style={tone && tone !== "grey" ? undefined : { background: "var(--m-card-2)" }}>
      {text}
    </span>
  );

  const card = (title: string, at: string, ownerId: number | null, body: React.ReactNode, actions?: React.ReactNode) => (
    <article className="m-card px-4 py-3">
      <header className="flex items-center gap-2">
        <span className="text-[19px] m-muted">{title}</span>
        <span className="text-[15px] m-muted">{timeOf(at)}</span>
        <span className="ml-auto">
          <MAvatar name={personName(ownerId)} size={30} />
        </span>
      </header>
      <div className="mt-2 text-[17px]">{body}</div>
      {actions}
    </article>
  );

  return (
    <div className="space-y-3 px-3 pt-3 pb-32">
      {composer && (
        <div className="m-card p-3 space-y-2">
          <div className="flex gap-2">
            {(["task", "comment"] as const).map((k) => (
              <button key={k} type="button" className={`m-pill py-1.5 text-[15px] ${composer === k ? "m-pill-active" : ""}`} onClick={() => setComposer(k)}>
                {k === "task" ? "Aktywność" : "Komentarz"}
              </button>
            ))}
            <button type="button" className="ml-auto p-2 m-muted" onClick={() => setComposer(null)} aria-label="Zamknij">
              <MIcon name="close" />
            </button>
          </div>
          <textarea ref={box} className="m-input" rows={3} placeholder={composer === "task" ? "Co jest do zrobienia?" : "Komentarz"} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={composer === "task" ? "Do zrobienia" : "Komentarz"} />
          {composer === "task" && (
            <label className="flex items-center gap-2 text-[15px] m-muted">
              Termin
              <input type="date" className="m-input flex-1 py-2 text-[15px]" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Termin" />
            </label>
          )}
          <button type="button" className="w-full rounded-xl py-3 text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: "var(--m-fab)" }} disabled={!draft.trim()} onClick={submit}>
            {composer === "task" ? "Zaplanuj" : "Wyślij"}
          </button>
        </div>
      )}

      <div className="flex justify-center">
        <span className="rounded-full bg-[#8fbc1f] px-4 py-1 text-[15px] font-semibold text-[#0c1b2a]">Rzeczy do zrobienia</span>
      </div>
      {openTasks.length === 0 ? (
        <button type="button" className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left" style={{ background: "#4a4224" }} onClick={() => setComposer("task")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8fbc1f] text-[#0c1b2a]">
            <MIcon name="plus" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-[19px] font-semibold">Utwórz aktywność</span>
            <span className="block text-[15px] m-muted">{hint}</span>
          </span>
        </button>
      ) : (
        openTasks.map((c) =>
          card(
            "Zadanie",
            c.created_at,
            c.author_id,
            <>
              <div className="whitespace-pre-wrap">{c.body}</div>
              {c.deadline && <div className="text-[13px] m-muted">termin: {new Date(c.deadline).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>}
            </>,
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded-xl bg-[#8fbc1f] px-4 py-2 text-[15px] font-semibold text-[#0c1b2a]" onClick={() => run(() => updateComment(c.id, { completed: true }))}>
                Wykonane
              </button>
              <button type="button" className="ml-auto px-3 py-2 text-[15px] text-red-400" onClick={() => window.confirm("Usunąć zadanie?") && run(() => deleteComment(c.id))}>
                Usuń
              </button>
            </div>,
          ),
        )
      )}

      {grouped.map((g) => (
        <div key={g.day} className="space-y-3">
          <div className="flex justify-center">
            <span className="rounded-full px-4 py-1 text-[15px]" style={{ background: "var(--m-card-2)" }}>
              {dayLabel(g.day)}
            </span>
          </div>
          {g.items.map((e) =>
            e.type === "comment"
              ? card(
                  e.comment.kind === "task" ? "Zadanie wykonane" : "Komentarz",
                  e.at,
                  e.comment.author_id,
                  <div className="whitespace-pre-wrap">{e.comment.body}</div>,
                  <div className="mt-2 text-right">
                    <button type="button" className="text-[13px] m-muted" onClick={() => window.confirm("Usunąć wpis?") && run(() => deleteComment(e.comment.id))}>
                      Usuń
                    </button>
                  </div>,
                )
              : card(
                  e.event.title === "Zmiana etapu" ? "Zmieniono etap" : e.event.title === "Deal utworzony" ? "Utworzono deal" : e.event.title === "Firma utworzona" ? "Utworzono firmę" : e.event.title,
                  e.at,
                  e.event.ownerId,
                  e.event.arrow ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {chip(e.event.arrow[0])}
                      <span className="m-muted">→</span>
                      {chip(e.event.arrow[1])}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {e.event.pills?.map((p) => chip(p.text, p.tone))}
                      {e.event.link && (
                        <button type="button" className={e.event.link.to.startsWith("/deals") || e.event.link.to.startsWith("/companies") ? "m-link" : ""} onClick={() => openRecord(e.event.link!.to)}>
                          {e.event.link.label}
                        </button>
                      )}
                      {e.event.suffix && <span className="m-muted">{e.event.suffix}</span>}
                    </div>
                  ),
                ),
          )}
        </div>
      ))}
      {!composer && (
        <button type="button" className="m-fab-pos fixed right-4 z-40 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: "var(--m-fab)" }} onClick={() => setComposer("comment")} aria-label="Dodaj wpis">
          <MIcon name="plus" className="h-7 w-7" strokeWidth={2.2} />
        </button>
      )}
      {error && <div className="fixed bottom-24 left-4 right-24 z-50 rounded-xl bg-red-600 px-4 py-2 text-sm text-white">{error}</div>}
    </div>
  );
}
