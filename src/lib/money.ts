import type { DealLine, NewLine } from "@/types";

const whole = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Bitrix style: whole amounts without decimals ("4 720 zł"), fractional with two ("265,80 zł"). */
export const formatPln = (value: number): string => {
  const v = round2(value);
  return `${Number.isInteger(v) ? whole.format(v) : cents.format(v)} zł`;
};
export const formatPlnShort = (value: number): string => `${whole.format(Math.round(value))} zł`;
/** Two decimals always, for editable price inputs and totals tables ("5,90"). */
export const formatCents = (value: number): string => cents.format(round2(value));

/** Line total the way Bitrix computes it: price x quantity, then the percentage discount, then the flat discount. */
export const lineTotal = (line: Pick<DealLine | NewLine, "price" | "quantity" | "discount_rate" | "discount_sum">): number => {
  const gross = line.price * line.quantity;
  const afterRate = gross * (1 - (line.discount_rate || 0) / 100);
  return round2(Math.max(0, afterRate - (line.discount_sum || 0)));
};

export const dealAmount = (lines: Pick<DealLine | NewLine, "price" | "quantity" | "discount_rate" | "discount_sum">[]): number =>
  round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));

export const discountTotal = (lines: Pick<DealLine | NewLine, "price" | "quantity" | "discount_rate" | "discount_sum">[]): number =>
  round2(lines.reduce((sum, line) => sum + line.price * line.quantity - lineTotal(line), 0));
