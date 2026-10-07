import { describe, expect, it } from "vitest";
import { stepSizes, stepWeight } from "../weight-adjust";

describe("stepSizes", () => {
  it("small step is the smallest loadable change (one smallest plate a side)", () => {
    expect(stepSizes([20, 15, 10, 5, 2.5, 1.25])).toEqual({ small: 2.5, big: 10 });
    expect(stepSizes([45, 35, 25, 10, 5, 2.5])).toEqual({ small: 5, big: 20 });
  });

  it("ignores plate order", () => {
    expect(stepSizes([1.25, 20, 5])).toEqual({ small: 2.5, big: 10 });
  });

  it("falls back to 2.5/10 when no plates are configured", () => {
    expect(stepSizes([])).toEqual({ small: 2.5, big: 10 });
  });
});

describe("stepWeight", () => {
  it("adds and subtracts", () => {
    expect(stepWeight(60, 2.5, 20)).toBe(62.5);
    expect(stepWeight(60, -10, 20)).toBe(50);
  });

  it("never goes below the bar", () => {
    expect(stepWeight(22.5, -10, 20)).toBe(20);
  });

  it("doesn't accumulate float drift", () => {
    let w = 20;
    for (let i = 0; i < 10; i++) w = stepWeight(w, 0.1, 20);
    expect(w).toBe(21);
  });
});
