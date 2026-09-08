import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Deal } from "@/types";
import { useData } from "@/store";
import { Avatar, Money } from "./ui";
import { formatDate } from "@/lib/dates";

export function DealCardBody({ deal, dragging = false }: { deal: Deal; dragging?: boolean }) {
  const { companyById, personName, commentsOf } = useData();
  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const notes = commentsOf("deal", deal.id).length;
  return (
    <div className={`card p-3 text-sm space-y-1 ${dragging ? "shadow-xl ring-2 ring-amber/70" : "hover:border-gray-500"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{deal.title}</span>
        {notes > 0 && (
          <span className="pill bg-panel-2 text-gray-300" title="Wpisy na osi czasu">
            {notes}
          </span>
        )}
      </div>
      {deal.repeat_customer && <div className="text-[11px] text-muted">powtarzalny deal</div>}
      <Money value={deal.amount} className="block text-base font-semibold" />
      <div className="truncate text-sky-300">{company?.name ?? <span className="text-muted">bez firmy</span>}</div>
      <div className="flex items-center justify-between text-xs text-muted pt-1">
        <span>{formatDate(deal.begin_date ?? deal.created_at)}</span>
        <Avatar name={personName(deal.owner_id)} size={6} />
      </div>
    </div>
  );
}

export default function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, data: { deal } });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-manipulation">
      <Link to={`/deals/${deal.id}`} className="block" draggable={false} onClick={(e) => isDragging && e.preventDefault()}>
        <DealCardBody deal={deal} />
      </Link>
    </div>
  );
}
