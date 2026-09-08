import type { Stage } from "@/types";

/** Bitrix list-row stage bar: one segment per open stage plus a closing one, filled up to the current stage in its colour. */
export default function StageMini({ stages, current }: { stages: Stage[]; current: string }) {
  const open = stages.filter((s) => s.semantic === "open");
  const stage = stages.find((s) => s.code === current);
  const closed = stage !== undefined && stage.semantic !== "open";
  const index = open.findIndex((s) => s.code === current);
  const color = closed ? (stage.semantic === "won" ? "#7cd44a" : "#f0455a") : (stage?.color ?? "#94a3b8");
  const segments = [...open.map((s) => s.name), closed ? stage.name : "Zamknij deal"];
  return (
    <div className="min-w-32">
      <div className="flex gap-0.5" aria-label={stage?.name}>
        {segments.map((name, i) => {
          const filled = closed || i <= index;
          return <span key={name} title={name} className="h-1.5 flex-1 rounded-sm" style={{ background: filled ? color : "#e2e8ee" }} />;
        })}
      </div>
      <div className="mt-1 text-[11px] text-gray-500 truncate">{stage?.name ?? current}</div>
    </div>
  );
}
