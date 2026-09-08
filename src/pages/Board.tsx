import { useMemo, useState } from "react";
import type { Stage } from "@/types";
import { useData } from "@/store";
import Kanban from "@/components/Kanban";
import DealGrid from "@/components/DealGrid";
import DealForm from "@/components/DealForm";
import FilterBar, { applyFilter, loadFilter, saveFilter, type DealFilter } from "@/components/FilterBar";
import { Toast } from "@/components/ui";
import { formatPln } from "@/lib/money";

/*
 * Bitrix "Deals" page: title + green "+ Utwórz", pipeline pill, filter/search pill, then the
 * Kanban | Lista toggle. Kanban and list share the filter; the closed stages become columns
 * after Faktura (Stracony, Analizowanie..., Wygrany) when no "in progress" preset is active.
 */
type Mode = "kanban" | "list";
const FINAL_ORDER = ["LOSE", "APOLOGY", "WON"];

export default function Board() {
  const { data, moveDeal, companyById, personName } = useData();
  const [filter, setFilterState] = useState<DealFilter>(loadFilter);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("browar-crm-deal-mode") as Mode) || "kanban");
  const [adding, setAdding] = useState<Stage | null | false>(false);
  const [error, setError] = useState<string | null>(null);

  const setFilter = (f: DealFilter) => {
    setFilterState(f);
    saveFilter(f);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem("browar-crm-deal-mode", m);
  };

  const orderedStages = useMemo(() => {
    const open = data.stages.filter((s) => s.semantic === "open").sort((a, b) => a.sort - b.sort);
    const finals = data.stages.filter((s) => s.semantic !== "open").sort((a, b) => FINAL_ORDER.indexOf(a.code) - FINAL_ORDER.indexOf(b.code));
    return [...open, ...finals];
  }, [data.stages]);
  const columns = useMemo(() => {
    if (filter.preset === "open") return orderedStages.filter((s) => s.semantic === "open");
    if (filter.preset === "closed") return orderedStages.filter((s) => s.semantic !== "open");
    if (filter.stage) return orderedStages.filter((s) => s.code === filter.stage);
    return orderedStages;
  }, [orderedStages, filter.preset, filter.stage]);
  const closing = useMemo(() => orderedStages.filter((s) => s.semantic !== "open"), [orderedStages]);

  const deals = useMemo(
    () =>
      applyFilter(
        data.deals,
        filter,
        data.stages,
        (id) => (id ? (companyById.get(id)?.name ?? "") : ""),
        (id) => (id ? (companyById.get(id)?.nip ?? "") : ""),
        personName,
      ),
    [data.deals, data.stages, filter, companyById, personName],
  );
  const total = deals.reduce((s, d) => s + d.amount, 0);

  const onMove = async (dealId: number, stageCode: string) => {
    try {
      await moveDeal(dealId, stageCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przenieść");
    }
  };

  return (
    <div className="flex h-full flex-col text-white">
      <div className="shrink-0 space-y-2 px-4 pt-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold mr-1">Deale</h1>
          <button type="button" className="btn-success py-1.5" onClick={() => setAdding(null)}>
            + Utwórz
          </button>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 5h16l-6 8v6l-4-2v-4z" strokeLinejoin="round" />
            </svg>
            Domyślny lejek
          </span>
          <FilterBar value={filter} onChange={setFilter} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-lg bg-white/10">
            {(
              [
                ["kanban", "Kanban"],
                ["list", "Lista"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button key={m} type="button" className={`px-4 py-1.5 ${mode === m ? "bg-white/25 text-white" : "text-white/80 hover:text-white"}`} onClick={() => switchMode(m)}>
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-white/80">
            {deals.length} dealów · {formatPln(total)}
          </span>
        </div>
      </div>
      {mode === "kanban" ? (
        <div className="min-h-0 flex-1">
          <Kanban stages={columns} closingStages={closing} deals={deals} onMove={onMove} onAdd={(s) => setAdding(s)} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-ink">
          <DealGrid deals={deals} onError={setError} />
        </div>
      )}
      {adding !== false && <DealForm open onClose={() => setAdding(false)} stage={adding} onError={setError} />}
      <Toast message={error} onDone={() => setError(null)} />
    </div>
  );
}
