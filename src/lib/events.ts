import type { Company, Deal, Snapshot, Stage } from "@/types";
import type { TimelineEvent } from "@/components/BxTimeline";
import { formatPln } from "./money";

/** Timeline events of a deal: creation and every stage move, derived from stage_history. Shared by web and mobile. */
export function dealEvents(data: Snapshot, deal: Deal, stageByCode: Map<string, Stage>): TimelineEvent[] {
  const history = data.stage_history.filter((h) => h.deal_id === deal.id).sort((a, b) => a.moved_at.localeCompare(b.moved_at));
  const list: TimelineEvent[] = [];
  history.forEach((h, i) => {
    const stage = stageByCode.get(h.stage_code);
    if (i === 0) {
      list.push({ key: `h${h.id}`, at: h.moved_at, title: "Deal utworzony", icon: "info", link: { to: `/deals/${deal.id}`, label: deal.title }, ownerId: h.moved_by ?? deal.owner_id });
      return;
    }
    const prev = stageByCode.get(history[i - 1].stage_code);
    const closed = stage && stage.semantic !== "open";
    list.push({
      key: `h${h.id}`,
      at: h.moved_at,
      title: closed ? "Deal zakończony" : "Zmiana etapu",
      icon: closed ? "up" : "stage",
      pills: closed ? [{ text: stage.name, tone: stage.semantic === "won" ? "won" : "lost" }] : undefined,
      arrow: closed ? undefined : [prev?.name ?? "", stage?.name ?? h.stage_code],
      ownerId: h.moved_by ?? deal.owner_id,
    });
  });
  if (history.length === 0) list.push({ key: "created", at: deal.created_at, title: "Deal utworzony", icon: "info", ownerId: deal.owner_id });
  return list;
}

/** Timeline events of a company: its creation, every deal created and every deal closed. */
export function companyEvents(data: Snapshot, company: Company, stageByCode: Map<string, Stage>): TimelineEvent[] {
  const deals = data.deals.filter((d) => d.company_id === company.id);
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const list: TimelineEvent[] = [{ key: "company", at: company.created_at, title: "Firma utworzona", icon: "info", link: { to: `/companies/${company.id}`, label: company.name }, ownerId: company.owner_id }];
  for (const d of deals)
    list.push({ key: `c${d.id}`, at: d.created_at, title: "Deal utworzony", icon: "deal", pills: [{ text: stageByCode.get(d.stage_code)?.name ?? d.stage_code, tone: "grey" }], link: { to: `/deals/${d.id}`, label: d.title }, suffix: formatPln(d.amount), ownerId: d.owner_id });
  for (const h of data.stage_history) {
    const deal = dealById.get(h.deal_id);
    const stage = stageByCode.get(h.stage_code);
    if (!deal || !stage || stage.semantic === "open") continue;
    list.push({ key: `h${h.id}`, at: h.moved_at, title: "Deal zakończony", icon: "up", pills: [{ text: stage.name, tone: stage.semantic === "won" ? "won" : "lost" }], link: { to: `/deals/${deal.id}`, label: deal.title }, suffix: formatPln(deal.amount), ownerId: h.moved_by ?? deal.owner_id });
  }
  return list;
}
