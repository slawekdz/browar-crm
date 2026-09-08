import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { Deal, Stage } from "@/types";
import DealCard, { DealCardBody } from "./DealCard";
import { formatPlnShort } from "@/lib/money";

/*
 * Bitrix kanban: columns fill the viewport (min 180 px), each scrolls vertically on its own,
 * the board scrolls horizontally with edge chevron buttons; header pill in the stage colour,
 * dark sum pill, "+ Szybki deal" in the first column and a "+" elsewhere.
 */
const PAGE = 60;

function Column({ stage, deals, first, onAdd }: { stage: Stage; deals: Deal[]; first: boolean; onAdd?: (stage: Stage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.code });
  const [limit, setLimit] = useState(PAGE);
  const total = deals.reduce((sum, d) => sum + d.amount, 0);
  return (
    <section className="group flex min-w-[250px] sm:min-w-[180px] flex-1 basis-0 flex-col snap-start border-r border-dotted border-white/25 px-1.5 last:border-r-0" aria-label={stage.name}>
      <header className="flex h-[34px] items-center justify-between rounded-full px-3 text-[13px] font-bold text-white" style={{ background: stage.color }} title={stage.name}>
        <span className="truncate">{stage.name}</span>
        <span className="ml-2 shrink-0 font-normal text-white/85">{deals.length}</span>
      </header>
      <div className="mx-auto mt-1.5 rounded-full bg-black/35 px-3 py-0.5 text-center text-[12px] font-medium text-white">{formatPlnShort(total)}</div>
      {onAdd && (
        <button type="button" className={`mt-1.5 rounded-full text-[12px] text-white/90 transition ${first ? "w-full bg-white/15 py-1 hover:bg-white/25" : "w-full py-1 hover:bg-white/15 group-hover:bg-white/10"}`} onClick={() => onAdd(stage)}>
          {first ? "+ Szybki deal" : "+"}
        </button>
      )}
      <div ref={setNodeRef} className={`scroll-thin mt-1.5 flex-1 space-y-2 overflow-y-auto rounded-lg pr-0.5 pb-2 ${isOver ? "bg-white/15" : ""}`}>
        {deals.slice(0, limit).map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length > limit && (
          <button type="button" className="w-full rounded-md bg-white/15 py-1 text-xs text-white hover:bg-white/25" onClick={() => setLimit((l) => l + PAGE)}>
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
    <div ref={setNodeRef} className={`flex-1 rounded-xl border-2 border-dashed px-3 py-3 text-center text-sm font-medium transition ${isOver ? "scale-[1.02]" : ""}`} style={{ borderColor: stage.color, color: "white", background: isOver ? stage.color : `${stage.color}55` }}>
      {stage.name}
    </div>
  );
}

export default function Kanban({ stages, closingStages, deals, onMove, onAdd }: { stages: Stage[]; closingStages: Stage[]; deals: Deal[]; onMove: (dealId: number, stageCode: string) => void; onAdd?: (stage: Stage) => void }) {
  const [active, setActive] = useState<Deal | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages) map.set(stage.code, []);
    for (const deal of deals) map.get(deal.stage_code)?.push(deal);
    for (const list of map.values()) list.sort((a, b) => (b.moved_at ?? b.created_at).localeCompare(a.moved_at ?? a.created_at));
    return map;
  }, [stages, deals]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => (el.removeEventListener("scroll", update), ro.disconnect());
  }, [stages.length]);

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as { deal: Deal }).deal);
  const onDragEnd = (e: DragEndEvent) => {
    const deal = active;
    setActive(null);
    const target = e.over?.id;
    if (!deal || typeof target !== "string" || target === deal.stage_code) return;
    onMove(deal.id, target);
  };
  const closingHidden = closingStages.filter((s) => !stages.some((x) => x.code === s.code));

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="relative flex h-full min-h-0 flex-col">
        {edges.left && (
          <button type="button" className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-xl text-white backdrop-blur hover:bg-white/50" onClick={() => scroller.current?.scrollBy({ left: -400, behavior: "smooth" })} aria-label="Przewiń w lewo">
            ‹
          </button>
        )}
        {edges.right && (
          <button type="button" className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-xl text-white backdrop-blur hover:bg-white/50" onClick={() => scroller.current?.scrollBy({ left: 400, behavior: "smooth" })} aria-label="Przewiń w prawo">
            ›
          </button>
        )}
        <div ref={scroller} className="scroll-x flex min-h-0 flex-1 snap-x overflow-x-auto px-2 pb-2">
          {stages.map((stage, i) => (
            <Column key={stage.code} stage={stage} deals={byStage.get(stage.code) ?? []} first={i === 0} onAdd={onAdd} />
          ))}
        </div>
        {active && closingHidden.length > 0 && (
          <div className="sticky bottom-0 z-30 flex gap-2 bg-indigo/80 px-4 py-3 backdrop-blur">
            {closingHidden.map((stage) => (
              <DropZone key={stage.code} stage={stage} />
            ))}
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-56"><DealCardBody deal={active} dragging /></div> : null}</DragOverlay>
    </DndContext>
  );
}
