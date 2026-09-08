import { describe, expect, it } from "vitest";
import { dealAmount, lineTotal } from "../../src/lib/money";

describe("lineTotal", () => {
  it("multiplies price by quantity", () => {
    expect(lineTotal({ price: 5.5, quantity: 20, discount_rate: 0, discount_sum: 0 })).toBe(110);
  });
  it("applies a percentage discount", () => {
    expect(lineTotal({ price: 100, quantity: 2, discount_rate: 10, discount_sum: 0 })).toBe(180);
  });
  it("applies a flat discount after the percentage", () => {
    expect(lineTotal({ price: 100, quantity: 2, discount_rate: 10, discount_sum: 30 })).toBe(150);
  });
  it("never goes below zero", () => {
    expect(lineTotal({ price: 1, quantity: 1, discount_rate: 0, discount_sum: 5 })).toBe(0);
  });
  it("rounds to grosze", () => {
    expect(lineTotal({ price: 5.7, quantity: 3, discount_rate: 33, discount_sum: 0 })).toBe(11.46);
  });
});

describe("dealAmount", () => {
  it("sums line totals", () => {
    expect(
      dealAmount([
        { price: 5.9, quantity: 24, discount_rate: 0, discount_sum: 0 },
        { price: 300, quantity: 1, discount_rate: 0, discount_sum: 0 },
      ]),
    ).toBe(441.6);
  });
  it("is zero for no lines", () => {
    expect(dealAmount([])).toBe(0);
  });
});
