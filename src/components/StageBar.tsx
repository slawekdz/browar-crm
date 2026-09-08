import { useState } from "react";
import type { Stage } from "@/types";

/*
 * Bitrix deal stage bar: chevrons up to the current stage filled with the current stage's colour,
 * later ones light grey with a coloured underline; hovering a later stage previews the fill in
 * that stage's colour (green for "Zamknij deal"). Clicking moves the deal; the closing segment
 * opens the won / lost chooser. Same stages as the board.
 */
export default function StageBar({ stages, current, onMove, disabled = false }: { stages: Stage[]; current: string; onMove: (code: string) => void; disabled?: boolean }) {
  const [closing, setClosing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const open = stages.filter((s) => s.semantic === "open");
  const finals = stages.filter((s) => s.semantic !== "open");
  const currentStage = stages.find((s) => s.code === current);
  const currentIndex = open.findIndex((s) => s.code === current);
  const isClosed = currentStage !== undefined && currentStage.semantic !== "open";
  const won = currentStage?.semantic === "won";
  const CLOSE_COLOR = "#7cd44a";
  const LOST_COLOR = "#f0455a";
  const segments = [...open.map((s) => ({ code: s.code, label: s.name, color: s.color })), { code: "__close", label: isClosed ? currentStage.name : "Zamknij deal", color: isClosed ? (won ? CLOSE_COLOR : LOST_COLOR) : CLOSE_COLOR }];
  const activeIndex = isClosed ? segments.length - 1 : currentIndex;
  const fillIndex = hover ?? activeIndex;
  const fillColor = hover !== null ? segments[hover].color : isClosed ? (won ? CLOSE_COLOR : LOST_COLOR) : (currentStage?.color ?? "#94a3b8");

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto scroll-x pb-1" role="group" aria-label="Etapy dealu" onMouseLeave={() => setHover(null)}>
        {segments.map((seg, i) => {
          const filled = i <= fillIndex;
          return (
            <button
              key={seg.code}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHover(i)}
              onClick={() => (seg.code === "__close" ? setClosing((v) => !v) : onMove(seg.code))}
              className={`relative h-[26px] min-w-24 flex-1 px-4 text-left text-[12px] font-medium transition disabled:cursor-wait ${filled ? "text-white" : "text-gray-600"}`}
              style={{
                clipPath: i === 0 ? "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)" : "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%, 9px 50%)",
                background: filled ? fillColor : "#e5e9ee",
                boxShadow: filled ? undefined : `inset 0 -2px 0 ${seg.color}`,
              }}
              title={seg.label}
              aria-current={i === activeIndex ? "step" : undefined}
            >
              <span className="block truncate pl-1">{seg.label}</span>
            </button>
          );
        })}
      </div>
      {closing && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm text-sm fade-in">
          <span className="text-gray-600">Zamknij deal jako:</span>
          {finals.map((s) => (
            <button key={s.code} type="button" className="rounded-lg px-3 py-1.5 font-medium text-white disabled:opacity-50" style={{ background: s.semantic === "won" ? CLOSE_COLOR : LOST_COLOR }} disabled={disabled || s.code === current} onClick={() => (setClosing(false), onMove(s.code))}>
              {s.name}
            </button>
          ))}
          <button type="button" className="ml-auto text-gray-500" onClick={() => setClosing(false)}>
            Anuluj
          </button>
        </div>
      )}
    </div>
  );
}
