import { describe, expect, it } from "vitest";
import { nextWorkoutType } from "../schedule";

describe("nextWorkoutType", () => {
  it("starts with A when there is no history", () => {
    expect(nextWorkoutType([])).toBe("A");
  });

  it("alternates B after A", () => {
    expect(
      nextWorkoutType([{ workoutType: "A", date: "2026-09-01" }]),
    ).toBe("B");
  });

  it("alternates A after B", () => {
    expect(
      nextWorkoutType([{ workoutType: "B", date: "2026-09-03" }]),
    ).toBe("A");
  });

  it("uses the most recent session regardless of array order", () => {
    const history = [
      { workoutType: "A" as const, date: "2026-09-08" },
      { workoutType: "B" as const, date: "2026-09-01" },
      { workoutType: "A" as const, date: "2026-09-05" },
    ];
    // most recent by date is 2026-09-08 -> A -> next is B
    expect(nextWorkoutType(history)).toBe("B");
  });
});
