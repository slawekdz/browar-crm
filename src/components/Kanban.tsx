import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Deal, Stage } from "@/types";
import DealCard, { DealCardBody } from "./DealCard";
import { formatPlnShort } from "@/lib/money";

const PAGE = 60;

function Column({ stage, deals, onAdd }: { stage: Stage; deals: Deal[]; onAdd?: (stage: Stage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.code });
  const [limit, setLimit] = useState(PAGE);
  const total = deals.reduce((sum, d) => sum + d.amount, 0);
  return (
    <section className="flex w-72 shrink-0 flex-col snap-start" aria-label={stage.name}>
      <header className="rounded-t-xl px-3 py-2 text-sm font-semibold text-ink" style={{ background: stage.color }}>
        <div className="flex items-center justify-between">
          <span>{stage.name}</span>
          <span className="rounded-full bg-black/15 px-2 text-xs">{deals.length}</span>
        </div>
      </header>
      <div className="bg-panel/60 px-3 py-1.5 text-center text-xs font-medium text-gray-200 border-x border-line">{formatPlnShort(total)}</div>
      <div ref={setNodeRef} className={`flex-1 space-y-2 rounded-b-xl border border-t-0 border-line p-2 min-h-40 ${isOver ? "bg-amber/10" : "bg-ink/40"}`}>
        {onAdd && (
          <button type="button" className="btn-ghost w-full py-1.5 text-xs" onClick={() => onAdd(stage)}>
            + Deal
          </button>
        )}
        {deals.slice(0, limit).map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length > limit && (
          <button type="button" className="btn-ghost w-full text-xs" onClick={() => setLimit((l) => l + PAGE)}>
            Pokaż więcej ({deals.length - limit})
          </button>
        )}
      </div>
    </section>
  );
}

function DropZone({ stage }: { stage: Stage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.code });
  return (
    <div ref={setNodeRef} className={`flex-1 rounded-xl border-2 border-dashed px-3 py-3 text-center text-sm font-medium transition ${isOver ? "scale-[1.02]" : ""}`} style={{ borderColor: stage.color, color: stage.color, background: isOver ? `${stage.color}22` : undefined }}>
      {stage.name}
    </div>
  );
}

export default function Kanban({ stages, closingStages, deals, onMove, onAdd }: { stages: Stage[]; closingStages: Stage[]; deals: Deal[]; onMove: (dealId: number, stageCode: string) => void; onAdd?: (stage: Stage) => void }) {
  const [active, setActive] = useState<Deal | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages) map.set(stage.code, []);
    for (const deal of deals) map.get(deal.stage_code)?.push(deal);
    for (const list of map.values()) list.sort((a, b) => (b.moved_at ?? b.created_at).localeCompare(a.moved_at ?? a.created_at));
    return map;
  }, [stages, deals]);

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as { deal: Deal }).deal);
  const onDragEnd = (e: DragEndEvent) => {
    const deal = active;
    setActive(null);
    const target = e.over?.id;
    if (!deal || typeof target !== "string" || target === deal.stage_code) return;
    onMove(deal.id, target);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="scroll-x flex gap-3 overflow-x-auto snap-x px-4 pb-4">
        {stages.map((stage) => (
          <Column key={stage.code} stage={stage} deals={byStage.get(stage.code) ?? []} onAdd={onAdd} />
        ))}
      </div>
      {active && closingStages.length > 0 && (
        <div className="sticky bottom-0 z-30 flex gap-2 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur">
          {closingStages.map((stage) => (
            <DropZone key={stage.code} stage={stage} />
          ))}
        </div>
      )}
      <DragOverlay dropAnimation={null}>{active ? <div className="w-72"><DealCardBody deal={active} dragging /></div> : null}</DragOverlay>
    </DndContext>
  );
}
