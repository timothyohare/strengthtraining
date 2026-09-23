import { describe, expect, it } from "vitest";
import { generateWarmupSets } from "../src/warmup";

describe("generateWarmupSets", () => {
  it("starts at the empty bar", () => {
    const sets = generateWarmupSets(225, 45);
    expect(sets[0]).toEqual({ weight: 45, reps: 5 });
  });

  it("produces a non-decreasing ramp that stays below the work weight", () => {
    const sets = generateWarmupSets(225, 45);
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i].weight).toBeGreaterThan(sets[i - 1].weight);
      expect(sets[i].weight).toBeLessThan(225);
    }
  });

  it("produces sensible steps for a heavy work weight", () => {
    const sets = generateWarmupSets(315, 45, 5);
    const weights = sets.map((s) => s.weight);
    // bar, ~45% (140->140), ~65% (205->205), ~85% (270->270)
    expect(weights).toEqual([45, 140, 205, 270]);
  });

  it("drops redundant steps for a work weight close to the bar", () => {
    // a beginner's first session: work weight only slightly above the bar
    const sets = generateWarmupSets(55, 45, 5);
    // 45%/65%/85% of 55 all round to <= 45 (the bar) and get filtered out
    expect(sets).toEqual([{ weight: 45, reps: 5 }]);
  });

  it("never produces a warm-up set at or above the work weight", () => {
    const sets = generateWarmupSets(95, 45, 5);
    for (const s of sets) {
      expect(s.weight).toBeLessThan(95);
    }
  });
});
