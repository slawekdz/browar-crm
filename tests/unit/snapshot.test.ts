import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/types";
import { dealAmount } from "../../src/lib/money";

// The snapshot holds customer data and is not committed; these checks run only where migrate/normalize.py produced it.
const snapshotUrl = new URL("../../public/snapshot.json", import.meta.url);
const snapshot = existsSync(snapshotUrl) ? (JSON.parse(readFileSync(snapshotUrl, "utf-8")) as Snapshot) : null;

describe.skipIf(!snapshot)("migrated snapshot", () => {
  if (!snapshot) return;
  it("carries the full Bitrix dataset", () => {
    expect(snapshot.deals.length).toBe(795);
    expect(snapshot.deal_lines.length).toBe(1831);
    expect(snapshot.companies.length).toBe(120);
    expect(snapshot.products.length).toBe(59);
    expect(snapshot.stage_history.length).toBe(2590);
  });

  it("keeps every deal on a known stage and every line on an existing deal", () => {
    const stages = new Set(snapshot.stages.map((s) => s.code));
    const deals = new Set(snapshot.deals.map((d) => d.id));
    expect(snapshot.deals.every((d) => stages.has(d.stage_code))).toBe(true);
    expect(snapshot.deal_lines.every((l) => deals.has(l.deal_id))).toBe(true);
    expect(snapshot.stage_history.every((h) => deals.has(h.deal_id))).toBe(true);
  });

  it("points every company and product reference at an existing row", () => {
    const companies = new Set(snapshot.companies.map((c) => c.id));
    const products = new Set(snapshot.products.map((p) => p.id));
    expect(snapshot.deals.filter((d) => d.company_id !== null).every((d) => companies.has(d.company_id!))).toBe(true);
    expect(snapshot.deal_lines.filter((l) => l.product_id !== null).every((l) => products.has(l.product_id!))).toBe(true);
  });

  it("reproduces the Bitrix deal amount from its lines for deals that have lines", () => {
    const byDeal = new Map<number, typeof snapshot.deal_lines>();
    for (const line of snapshot.deal_lines) byDeal.set(line.deal_id, [...(byDeal.get(line.deal_id) ?? []), line]);
    let mismatches = 0;
    for (const [dealId, lines] of byDeal) {
      const deal = snapshot.deals.find((d) => d.id === dealId)!;
      if (Math.abs(dealAmount(lines) - deal.amount) > 0.01) mismatches += 1;
    }
    // Bitrix lets the header amount drift from the lines when a user overtypes it; only a handful do.
    expect(mismatches).toBeLessThanOrEqual(15);
  });

  it("sums won deals to the Bitrix total", () => {
    const won = snapshot.deals.filter((d) => d.stage_code === "WON").reduce((s, d) => s + d.amount, 0);
    expect(Math.round(won * 100) / 100).toBe(421811.54);
  });
});
