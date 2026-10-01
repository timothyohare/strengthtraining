import { describe, expect, it } from "vitest";
import { nextSetState, PENDING_SET } from "../set-tap";
import { REPS_PER_SET } from "../program-engine/workouts";

describe("nextSetState (StrongLifts-style tap cycle)", () => {
  it("first tap logs a completed full set", () => {
    expect(nextSetState(PENDING_SET)).toEqual({
      status: "logged",
      completed: true,
      actualReps: REPS_PER_SET,
    });
  });

  it("each further tap takes a rep off and marks the set missed", () => {
    const full = nextSetState(PENDING_SET);
    expect(nextSetState(full)).toEqual({
      status: "logged",
      completed: false,
      actualReps: REPS_PER_SET - 1,
    });
  });

  it("counts down to zero reps, then clears back to not done", () => {
    let s = nextSetState(PENDING_SET);
    for (let i = 0; i < REPS_PER_SET; i++) s = nextSetState(s);
    expect(s).toEqual({ status: "logged", completed: false, actualReps: 0 });
    expect(nextSetState(s)).toEqual(PENDING_SET);
  });
});
