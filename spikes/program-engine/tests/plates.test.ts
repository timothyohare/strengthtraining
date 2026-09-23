import { describe, expect, it } from "vitest";
import { calculatePlates } from "../src/plates";

const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5];

describe("calculatePlates", () => {
  it("returns no plates when the target is the bar weight", () => {
    const result = calculatePlates(45, 45, STANDARD_PLATES);
    expect(result).toEqual({ perSide: [], achievedWeight: 45 });
  });

  it("computes an exact loadable weight", () => {
    // 225 - 45 = 180 total plate weight, 90/side -> 45 + 45 = 90
    const result = calculatePlates(225, 45, STANDARD_PLATES);
    expect(result.perSide).toEqual([45, 45]);
    expect(result.achievedWeight).toBe(225);
  });

  it("combines multiple plate sizes per side", () => {
    // 185 - 45 = 140 total, 70/side -> 45 + 25
    const result = calculatePlates(185, 45, STANDARD_PLATES);
    expect(result.perSide).toEqual([45, 25]);
    expect(result.achievedWeight).toBe(185);
  });

  it("picks the closest achievable weight when not exactly loadable, preferring a small overshoot over a bigger undershoot", () => {
    // per-side target diff of 7lb with [5, 2.5] available: 5 alone is off by 2,
    // 5+2.5=7.5 is off by 0.5 -> should pick 5+2.5
    const result = calculatePlates(45 + 14, 45, [5, 2.5]); // target 59, per-side target 7
    expect(result.perSide).toEqual([5, 2.5]);
    expect(result.achievedWeight).toBe(60); // 45 + 2*7.5
  });

  it("never crashes or exceeds sensible bounds on an odd target", () => {
    const result = calculatePlates(101, 45, STANDARD_PLATES);
    expect(result.achievedWeight).toBeGreaterThanOrEqual(45);
    expect(Number.isFinite(result.achievedWeight)).toBe(true);
  });

  it("handles a target below the bar weight gracefully", () => {
    const result = calculatePlates(30, 45, STANDARD_PLATES);
    expect(result).toEqual({ perSide: [], achievedWeight: 45 });
  });
});
