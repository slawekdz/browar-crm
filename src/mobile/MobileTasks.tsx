import { useMemo } from "react";
import { useData } from "@/store";
import { useOpenRecord } from "@/lib/nav";
import { isPast } from "@/lib/dates";
import { MIcon } from "./ui";

/* "Zadania" tab of the bottom bar: every open activity across deals and companies, overdue first. */
export default function MobileTasks() {
  const { data, companyById } = useData();
  const openRecord = useOpenRecord();
  const tasks = useMemo(
    () => data.comments.filter((c) => c.kind === "task" && !c.completed).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")),
    [data.comments],
  );
  const label = (c: (typeof tasks)[number]) => {
    if (c.entity_type === "deal") return data.deals.find((d) => d.id === c.entity_id)?.title ?? `Deal #${c.entity_id}`;
    if (c.entity_type === "company") return companyById.get(c.entity_id)?.name ?? `Firma #${c.entity_id}`;
    return `Kontakt #${c.entity_id}`;
  };
  const path = (c: (typeof tasks)[number]) => (c.entity_type === "deal" ? `/deals/${c.entity_id}?tab=timeline` : c.entity_type === "company" ? `/companies/${c.entity_id}?tab=timeline` : "/contacts");
  return (
    <div className="space-y-3 px-3 pt-3 pb-28">
      {tasks.map((c) => {
        const overdue = isPast(c.deadline);
        return (
          <button key={c.id} type="button" className="m-card flex w-full items-start gap-3 px-4 py-4 text-left" onClick={() => openRecord(path(c))}>
            <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${overdue ? "bg-red-500/20 text-red-400" : "text-[#8fbc1f]"}`} style={overdue ? undefined : { background: "var(--m-card-2)" }}>
              <MIcon name="tasks" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] leading-snug">{c.body}</span>
              <span className="mt-1 block text-[15px] m-link">{label(c)}</span>
              {c.deadline && <span className={`mt-1 block text-[13px] ${overdue ? "text-red-400" : "m-muted"}`}>{overdue ? "Po terminie: " : "Termin: "}{new Date(c.deadline).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>}
            </span>
          </button>
        );
      })}
      {tasks.length === 0 && <div className="m-card p-8 text-center m-muted">Brak otwartych zadań. Zaplanuj aktywność na dealu albo firmie.</div>}
    </div>
  );
}
