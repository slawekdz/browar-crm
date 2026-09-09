import { useMemo, useState } from "react";
import type { Deal, Stage } from "@/types";
import { useData } from "@/store";
import { useOpenRecord } from "@/lib/nav";
import { formatPln } from "@/lib/money";
import { formatRelativeDay } from "@/lib/dates";
import { IconRail, MIcon, Sheet, SheetItem } from "./ui";

/*
 * Bitrix24 mobile "Deale": funnel header (stage selector + total), then one card per deal with the
 * stage chevron (tap = move), amount, client and the icon rail. "⋯" opens the card menu.
 */
const FINAL_ORDER = ["LOSE", "APOLOGY", "WON"];

export function StageChevron({ stages, current, onPick }: { stages: Stage[]; current: string; onPick: () => void }) {
  const ordered = [...stages.filter((s) => s.semantic === "open"), ...stages.filter((s) => s.semantic !== "open").sort((a, b) => FINAL_ORDER.indexOf(a.code) - FINAL_ORDER.indexOf(b.code))];
  const idx = ordered.findIndex((s) => s.code === current);
  const cur = ordered[idx];
  const next = cur?.semantic === "open" ? (ordered[idx + 1]?.semantic === "open" ? ordered[idx + 1] : ordered.find((s) => s.code === "WON")) : null;
  const color = cur?.semantic === "won" ? "#7cd44a" : cur?.semantic === "lost" ? "#f0455a" : (cur?.color ?? "#4fd1e0");
  return (
    <div className="-mx-4 flex items-center overflow-hidden" aria-label="Etap">
      <span className="h-12 w-6 shrink-0" style={{ background: color, clipPath: "polygon(0 0, 60% 0, 100% 50%, 60% 100%, 0 100%)", opacity: idx > 0 ? 1 : 0 }} />
      <button type="button" className="flex h-12 min-w-0 flex-1 items-center justify-between px-4 text-[17px] font-medium text-[#0c1b2a]" style={{ background: color, clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)" }} onClick={onPick}>
        <span className="truncate">{cur?.name ?? current}</span>
        <MIcon name="down" className="ml-2 h-4 w-4 shrink-0" strokeWidth={2.5} />
      </button>
      {next && (
        <button type="button" className="flex h-12 flex-1 items-center px-4 text-[17px] m-muted truncate" style={{ boxShadow: `inset 0 -3px 0 ${next.semantic === "won" ? "#7cd44a" : next.color}` }} onClick={onPick}>
          <span className="truncate">{next.name}</span>
        </button>
      )}
    </div>
  );
}

export function StagePicker({ open, onClose, stages, current, onPick }: { open: boolean; onClose: () => void; stages: Stage[]; current: string; onPick: (code: string) => void }) {
  const ordered = [...stages.filter((s) => s.semantic === "open"), ...stages.filter((s) => s.semantic !== "open").sort((a, b) => FINAL_ORDER.indexOf(a.code) - FINAL_ORDER.indexOf(b.code))];
  return (
    <Sheet open={open} onClose={onClose} title="Etap">
      {ordered.map((s) => (
        <button key={s.code} type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[17px] hover:bg-white/5 ${s.code === current ? "bg-white/10" : ""}`} onClick={() => (onPick(s.code), onClose())}>
          <span className="h-3 w-3 rounded-full" style={{ background: s.semantic === "won" ? "#7cd44a" : s.semantic === "lost" ? "#f0455a" : s.color }} />
          <span className="flex-1">{s.name}</span>
          {s.code === current && <MIcon name="check" className="h-5 w-5 m-link" />}
        </button>
      ))}
    </Sheet>
  );
}

export function DealMobileCard({ deal, onMenu, onStage }: { deal: Deal; onMenu: () => void; onStage: () => void }) {
  const { data, companyById, commentsOf } = useData();
  const openRecord = useOpenRecord();
  const company = deal.company_id ? companyById.get(deal.company_id) : null;
  const timeline = commentsOf("deal", deal.id).length + data.stage_history.filter((h) => h.deal_id === deal.id).length;
  return (
    <article className="m-card px-4 py-4">
      <header className="flex items-start justify-between">
        <button type="button" className="min-w-0 text-left" onClick={() => openRecord(`/deals/${deal.id}`)}>
          <div className="text-[22px] font-semibold leading-tight">{deal.title}</div>
          <div className="mt-1 text-[15px] m-muted">
            {formatRelativeDay(deal.begin_date ?? deal.created_at).replace(/^./, (c) => c.toUpperCase())}
            {deal.repeat_customer ? ", powtarzalny deal" : ""}
          </div>
        </button>
        <button type="button" className="p-2 m-muted" onClick={onMenu} aria-label={`Menu ${deal.title}`}>
          <MIcon name="more" className="h-6 w-6" strokeWidth={3} />
        </button>
      </header>
      <div className="mt-3">
        <StageChevron stages={data.stages} current={deal.stage_code} onPick={onStage} />
      </div>
      <div className="mt-4 flex gap-3">
        <button type="button" className="min-w-0 flex-1 space-y-4 text-left" onClick={() => openRecord(`/deals/${deal.id}`)}>
          <div>
            <div className="m-label">Kwota deala</div>
            <div className="text-[28px] font-semibold leading-tight tabular-nums">{formatPln(deal.amount)}</div>
          </div>
          <div>
            <div className="m-label">Klient</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[19px]">
              {company ? (
                <>
                  <span className="m-link truncate" onClick={(e) => (e.stopPropagation(), openRecord(`/companies/${company.id}`))}>
                    {company.name}
                  </span>
                  <span className="rounded-full border border-[#3ea0ea] px-2 py-0.5 text-[12px] m-link">firma</span>
                </>
              ) : (
                <span className="m-muted">bez firmy</span>
              )}
            </div>
          </div>
        </button>
        <IconRail count={timeline} phone={company?.phone} email={company?.email} onTimeline={() => openRecord(`/deals/${deal.id}?tab=timeline`)} />
      </div>
    </article>
  );
}

export default function MobileDeals({ query }: { query: string }) {
  const { data, moveDeal, deleteDeal, companyById } = useData();
  const openRecord = useOpenRecord();
  const [stageFilter, setStageFilter] = useState<string>("open");
  const [pickingFilter, setPickingFilter] = useState(false);
  const [menuFor, setMenuFor] = useState<Deal | null>(null);
  const [stageFor, setStageFor] = useState<Deal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deals = useMemo(() => {
    const semantic = new Map(data.stages.map((s) => [s.code, s.semantic]));
    const q = query.trim().toLowerCase();
    return data.deals
      .filter((d) => (stageFilter === "open" ? semantic.get(d.stage_code) === "open" : stageFilter === "all" ? true : d.stage_code === stageFilter))
      .filter((d) => !q || [d.title, `#${d.id}`, d.company_id ? companyById.get(d.company_id)?.name : ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.moved_at ?? b.created_at).localeCompare(a.moved_at ?? a.created_at));
  }, [data.deals, data.stages, stageFilter, query, companyById]);
  const total = deals.reduce((s, d) => s + d.amount, 0);
  const openCount = data.stages.filter((s) => s.semantic === "open").length;
  const filterLabel = stageFilter === "open" ? `Wszystkie etapy (${openCount})` : stageFilter === "all" ? `Wszystkie deale (${data.stages.length})` : (data.stages.find((s) => s.code === stageFilter)?.name ?? "");

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    }
  };

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--m-card)" }}>
        <span className="m-round h-12 w-12 shrink-0">
          <MIcon name="funnel" />
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPickingFilter(true)}>
          <div className="text-[13px] m-muted truncate">Lejek „Domyślny lejek"</div>
          <div className="flex items-center gap-1 text-[19px]">
            <span className="truncate">{filterLabel}</span>
            <MIcon name="down" className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          </div>
        </button>
        <div className="shrink-0 text-right">
          <div className="text-[13px] m-muted">Kwota, zł</div>
          <div className="text-[19px] tabular-nums">{formatPln(total).replace(" zł", "")}</div>
        </div>
      </div>
      <div className="space-y-3 px-3 pt-3">
        {deals.slice(0, 60).map((d) => (
          <DealMobileCard key={d.id} deal={d} onMenu={() => setMenuFor(d)} onStage={() => setStageFor(d)} />
        ))}
        {deals.length === 0 && <div className="m-card p-6 text-center m-muted">Brak dealów</div>}
        {deals.length > 60 && <div className="py-3 text-center text-sm m-muted">Pokazano 60 z {deals.length}, zawęź etap albo wyszukaj.</div>}
      </div>
      {error && <div className="fixed bottom-24 left-4 right-24 z-50 rounded-xl bg-red-600 px-4 py-2 text-sm text-white">{error}</div>}

      <Sheet open={pickingFilter} onClose={() => setPickingFilter(false)} title="Etapy">
        {[
          ["open", `Wszystkie etapy (${openCount})`],
          ["all", `Wszystkie deale (${data.stages.length})`],
          ...data.stages.map((s) => [s.code, s.name] as [string, string]),
        ].map(([code, label]) => (
          <SheetItem key={code} onClick={() => (setStageFilter(code), setPickingFilter(false))} icon={stageFilter === code ? "check" : undefined}>
            {label}
          </SheetItem>
        ))}
      </Sheet>

      {stageFor && <StagePicker open onClose={() => setStageFor(null)} stages={data.stages} current={stageFor.stage_code} onPick={(code) => run(() => moveDeal(stageFor.id, code))} />}

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor && (
          <>
            <SheetItem icon="pencil" onClick={() => (openRecord(`/deals/${menuFor.id}`), setMenuFor(null))}>
              Edytuj
            </SheetItem>
            <SheetItem icon="tasks" onClick={() => (openRecord(`/deals/${menuFor.id}?tab=timeline&compose=task`), setMenuFor(null))}>
              Zaplanuj aktywność
            </SheetItem>
            <SheetItem icon="funnel" onClick={() => (setStageFor(menuFor), setMenuFor(null))}>
              Zmień etap
            </SheetItem>
            <SheetItem icon="timeline" onClick={() => (openRecord(`/deals/${menuFor.id}?tab=timeline`), setMenuFor(null))}>
              Wyświetl oś czasu
            </SheetItem>
            <SheetItem icon="trash" danger onClick={() => window.confirm(`Usunąć ${menuFor.title}?`) && (run(() => deleteDeal(menuFor.id)), setMenuFor(null))}>
              Usuń
            </SheetItem>
          </>
        )}
      </Sheet>
    </div>
  );
}
