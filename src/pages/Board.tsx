import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Stage } from "@/types";
import { useData } from "@/store";
import Kanban from "@/components/Kanban";
import DealForm from "@/components/DealForm";
import { Money, SearchInput, Toast, matches } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type View = "open" | "won" | "lost" | "all";
const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "W toku" },
  { key: "won", label: "Wygrane" },
  { key: "lost", label: "Stracone" },
  { key: "all", label: "Wszystkie" },
];

export default function Board() {
  const { data, moveDeal, companyById } = useData();
  const [view, setView] = useState<View>("open");
  const [mode, setMode] = useState<"kanban" | "list">("kanban");
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [adding, setAdding] = useState<Stage | null | false>(false);
  const [error, setError] = useState<string | null>(null);

  const stages = useMemo(() => data.stages.filter((s) => (view === "all" ? true : s.semantic === view)), [data.stages, view]);
  const closing = useMemo(() => data.stages.filter((s) => s.semantic !== "open"), [data.stages]);
  const years = useMemo(() => [...new Set(data.deals.map((d) => (d.begin_date ?? d.created_at).slice(0, 4)))].sort().reverse(), [data.deals]);
  const deals = useMemo(
    () =>
      data.deals.filter((d) => {
        if (year && !(d.begin_date ?? d.created_at).startsWith(year)) return false;
        const company = d.company_id ? companyById.get(d.company_id) : null;
        return matches(q, d.title, `#${d.id}`, company?.name, company?.nip, d.comment);
      }),
    [data.deals, q, year, companyById],
  );
  const visible = useMemo(() => deals.filter((d) => stages.some((s) => s.code === d.stage_code)), [deals, stages]);
  const total = visible.reduce((sum, d) => sum + d.amount, 0);

  const onMove = async (dealId: number, stageCode: string) => {
    try {
      await moveDeal(dealId, stageCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przenieść");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 space-y-2 bg-ink/95 px-4 pt-3 pb-2 backdrop-blur border-b border-line">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold mr-auto">Deale</h1>
          <button type="button" className="btn-primary" onClick={() => setAdding(null)}>
            + Deal
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line overflow-hidden text-xs">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" className={`px-3 py-1.5 ${view === v.key ? "bg-panel-2 text-white" : "text-gray-400"}`} onClick={() => setView(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-line overflow-hidden text-xs">
            <button type="button" className={`px-3 py-1.5 ${mode === "kanban" ? "bg-panel-2 text-white" : "text-gray-400"}`} onClick={() => setMode("kanban")}>
              Kanban
            </button>
            <button type="button" className={`px-3 py-1.5 ${mode === "list" ? "bg-panel-2 text-white" : "text-gray-400"}`} onClick={() => setMode("list")}>
              Lista
            </button>
          </div>
          <select className="input w-24" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Rok">
            <option value="">Rok</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex-1 min-w-40">
            <SearchInput value={q} onChange={setQ} placeholder="Firma, numer, NIP" />
          </div>
          <div className="text-xs text-muted">
            {visible.length} dealów · <Money value={total} />
          </div>
        </div>
      </div>
      {mode === "kanban" ? (
        <div className="flex-1 pt-3">
          <Kanban stages={stages} closingStages={closing} deals={visible} onMove={onMove} onAdd={(s) => setAdding(s)} />
        </div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="text-left">
                <th className="py-2 pr-3">Deal</th>
                <th className="py-2 pr-3">Firma</th>
                <th className="py-2 pr-3">Etap</th>
                <th className="py-2 pr-3 text-right">Kwota</th>
                <th className="py-2 pr-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible
                .slice()
                .sort((a, b) => b.id - a.id)
                .slice(0, 300)
                .map((d) => {
                  const stage = data.stages.find((s) => s.code === d.stage_code);
                  return (
                    <tr key={d.id} className="hover:bg-panel">
                      <td className="py-2 pr-3">
                        <Link to={`/deals/${d.id}`} className="text-sky-300">
                          {d.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 truncate max-w-64">{d.company_id ? companyById.get(d.company_id)?.name : ""}</td>
                      <td className="py-2 pr-3">
                        <span className="pill text-ink" style={{ background: stage?.color }}>
                          {stage?.name}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Money value={d.amount} />
                      </td>
                      <td className="py-2 pr-3 text-muted">{formatDate(d.begin_date ?? d.created_at)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {visible.length > 300 && <div className="py-3 text-xs text-muted">Pokazano 300 z {visible.length}, zawęź filtrem.</div>}
        </div>
      )}
      {adding !== false && <DealForm open onClose={() => setAdding(false)} stage={adding} onError={setError} />}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
