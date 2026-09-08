import type { DealLine, NewLine } from "@/types";

const pln = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 });
const plnShort = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });

export const formatPln = (value: number): string => pln.format(value);
export const formatPlnShort = (value: number): string => plnShort.format(value);

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Line total the way Bitrix computes it: price x quantity, then the percentage discount, then the flat discount. */
export const lineTotal = (line: Pick<DealLine | NewLine, "price" | "quantity" | "discount_rate" | "discount_sum">): number => {
  const gross = line.price * line.quantity;
  const afterRate = gross * (1 - (line.discount_rate || 0) / 100);
  return round2(Math.max(0, afterRate - (line.discount_sum || 0)));
};

export const dealAmount = (lines: Pick<DealLine | NewLine, "price" | "quantity" | "discount_rate" | "discount_sum">[]): number =>
  round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
