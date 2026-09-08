import { useState } from "react";
import type { Stage } from "@/types";

/*
 * Bitrix24 deal stage bar: open stages as orange chevrons up to the current one, grey beyond it,
 * and a final "Zamknij deal" segment that opens the closing choice (won / lost). Clicking any
 * segment moves the deal, so the bar and the board share exactly the same stages.
 */
export default function StageBar({ stages, current, onMove, disabled = false }: { stages: Stage[]; current: string; onMove: (code: string) => void; disabled?: boolean }) {
  const [closing, setClosing] = useState(false);
  const open = stages.filter((s) => s.semantic === "open");
  const finals = stages.filter((s) => s.semantic !== "open");
  const currentStage = stages.find((s) => s.code === current);
  const currentIndex = open.findIndex((s) => s.code === current);
  const isClosed = currentStage !== undefined && currentStage.semantic !== "open";
  const won = currentStage?.semantic === "won";

  const segment = (label: string, active: boolean, tone: "orange" | "green" | "red" | "grey", onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative h-10 min-w-28 flex-1 px-4 text-left text-sm font-medium transition disabled:cursor-wait ${
        { orange: "bg-[#ffa900] text-gray-900", green: "bg-[#9dcf00] text-white", red: "bg-[#ff5752] text-white", grey: "bg-gray-200 text-gray-600 hover:bg-gray-300" }[tone]
      } ${active ? "ring-2 ring-offset-1 ring-gray-500/40" : ""}`}
      style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" }}
      title={label}
    >
      <span className="block truncate pl-2">{label}</span>
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto scroll-x pb-1" role="group" aria-label="Etapy dealu">
        {open.map((s, i) =>
          segment(s.name, s.code === current, isClosed ? (won ? "green" : "grey") : i <= currentIndex ? "orange" : "grey", () => onMove(s.code), s.code),
        )}
        {segment(isClosed ? currentStage!.name : "Zamknij deal", isClosed, isClosed ? (won ? "green" : "red") : "grey", () => setClosing((v) => !v), "close")}
      </div>
      {closing && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm text-sm">
          <span className="text-gray-600">Zamknij deal jako:</span>
          {finals.map((s) => (
            <button
              key={s.code}
              type="button"
              className={`rounded-lg px-3 py-1.5 font-medium text-white ${s.semantic === "won" ? "bg-[#9dcf00]" : "bg-[#ff5752]"} ${s.code === current ? "opacity-50" : ""}`}
              disabled={disabled || s.code === current}
              onClick={() => (setClosing(false), onMove(s.code))}
            >
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
