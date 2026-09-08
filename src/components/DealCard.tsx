import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Deal } from "@/types";
import { useData } from "@/store";
import { RecordLink, useOpenRecord } from "@/lib/nav";
import { Avatar } from "./ui";
import { formatPln } from "@/lib/money";
import { formatRelativeDay, formatShortDay, isPast } from "@/lib/dates";

/*
 * Bitrix kanban card: bold title with an activity badge, "powtarzalny deal", amount, company link,
 * long-form date, icon rail (phone / mail / chat) on the right, footer "+ Aktywność" + modified date + avatar.
 */
function RailIcon({ d, active, title }: { d: string; active: boolean; title: string }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center ${active ? "text-link" : "text-gray-300"}`} title={title}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}

export function DealCardBody({ deal, dragging = false }: { deal: Deal; dragging?: boolean }) {
  const { companyById, personName, commentsOf } = useData();
  const openRecord = useOpenRecord();
  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const tasks = commentsOf("deal", deal.id).filter((c) => c.kind === "task" && !c.completed);
  const overdue = tasks.some((t) => isPast(t.deadline));
  return (
    <div className={`relative rounded-md bg-white p-3 pr-9 text-[13px] text-ink shadow-sm ${dragging ? "shadow-xl ring-2 ring-brand/70" : "hover:shadow-md"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight hover:underline">{deal.title}</span>
        <span className={`shrink-0 rounded-full px-1.5 text-[11px] font-medium ${overdue ? "bg-danger text-white" : "bg-gray-100 text-gray-500"}`} title="Zaplanowane aktywności">
          {tasks.length}
        </span>
      </div>
      {deal.repeat_customer && <div className="text-[11px] text-gray-500">powtarzalny deal</div>}
      <div className="mt-1 font-semibold">{formatPln(deal.amount)}</div>
      {company ? (
        <RecordLink to={`/companies/${company.id}`} className="block text-link hover:underline leading-snug" onClick={(e) => e.stopPropagation()} draggable={false}>
          {company.name}
        </RecordLink>
      ) : (
        <div className="text-gray-400">bez firmy</div>
      )}
      <div className="mt-0.5 text-[11px] text-gray-500">{formatRelativeDay(deal.begin_date ?? deal.created_at)}</div>
      <div className="absolute right-2 top-3 flex flex-col gap-1.5">
        <RailIcon d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" active={!!company?.phone} title={company?.phone ?? "Brak telefonu"} />
        <RailIcon d="M3 6h18v12H3zM3 7l9 6 9-6" active={!!company?.email} title={company?.email ?? "Brak e-maila"} />
        <RailIcon d="M4 5h16v10H8l-4 4z" active={false} title="Brak komunikacji na czacie" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500 whitespace-nowrap">
        <button type="button" className="hover:text-link" onClick={(e) => (e.stopPropagation(), openRecord(`/deals/${deal.id}`))}>
          + Aktywność
        </button>
        <span className="flex items-center gap-1.5 truncate">
          {formatShortDay(deal.updated_at)}
          <Avatar name={personName(deal.owner_id)} size={20} />
        </span>
      </div>
    </div>
  );
}

export default function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, data: { deal } });
  const openRecord = useOpenRecord();
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-manipulation cursor-pointer" onClick={() => !isDragging && openRecord(`/deals/${deal.id}`)}>
      <DealCardBody deal={deal} />
    </div>
  );
}
