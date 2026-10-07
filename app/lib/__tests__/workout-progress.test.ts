import { describe, expect, it } from "vitest";
import {
  parseSavedWorkout,
  restRemainingSeconds,
  restoreSets,
  type SavedWorkout,
} from "../workout-progress";
import { PENDING_SET } from "../set-tap";

const saved: SavedWorkout = {
  date: "2026-10-07",
  workoutType: "A",
  sessionId: "abc",
  sets: {
    "Squat#1": { status: "logged", completed: true, actualReps: 5 },
    "Squat#2": { status: "logged", completed: false, actualReps: 3 },
  },
  restEndsAt: 1_000_000,
};
const today = { date: "2026-10-07", workoutType: "A" as const };

describe("parseSavedWorkout", () => {
  it("restores today's workout of the same type", () => {
    expect(parseSavedWorkout(JSON.stringify(saved), today)).toEqual(saved);
  });

  it("ignores a workout from another day or of the other type", () => {
    expect(parseSavedWorkout(JSON.stringify(saved), { ...today, date: "2026-10-08" })).toBeNull();
    expect(parseSavedWorkout(JSON.stringify(saved), { ...today, workoutType: "B" })).toBeNull();
  });

  it("ignores missing or corrupt data instead of throwing", () => {
    expect(parseSavedWorkout(null, today)).toBeNull();
    expect(parseSavedWorkout("not json", today)).toBeNull();
    expect(parseSavedWorkout(JSON.stringify({ date: "2026-10-07" }), today)).toBeNull();
  });
});

describe("restoreSets", () => {
  it("keeps saved sets and fills the rest as not done", () => {
    const sets = restoreSets([{ liftName: "Squat", setCount: 3 }], saved.sets);
    expect(sets).toEqual({
      "Squat#1": saved.sets["Squat#1"],
      "Squat#2": saved.sets["Squat#2"],
      "Squat#3": PENDING_SET,
    });
  });

  it("drops saved sets for lifts or set numbers no longer in the workout", () => {
    const sets = restoreSets([{ liftName: "Squat", setCount: 1 }], {
      ...saved.sets,
      "Row#1": PENDING_SET,
    });
    expect(Object.keys(sets)).toEqual(["Squat#1"]);
  });

  it("all not done when nothing is saved", () => {
    expect(restoreSets([{ liftName: "Squat", setCount: 2 }], undefined)).toEqual({
      "Squat#1": PENDING_SET,
      "Squat#2": PENDING_SET,
    });
  });
});

describe("restRemainingSeconds", () => {
  it("counts from the clock, so time hidden in the background still counts", () => {
    expect(restRemainingSeconds(180_000, 0)).toBe(180);
    expect(restRemainingSeconds(180_000, 179_001)).toBe(1);
    expect(restRemainingSeconds(180_000, 100_000)).toBe(80);
  });

  it("never goes negative", () => {
    expect(restRemainingSeconds(180_000, 500_000)).toBe(0);
  });
});
