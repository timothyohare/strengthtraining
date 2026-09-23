import { describe, expect, it } from "vitest";
import { nextLiftState, type LiftState } from "../progression";

function baseState(overrides: Partial<LiftState> = {}): LiftState {
  return {
    name: "Squat",
    currentWeight: 100,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
    ...overrides,
  };
}

describe("nextLiftState", () => {
  it("increases weight and resets fail streak on a full completion", () => {
    const next = nextLiftState(baseState({ failStreak: 2 }), {
      completed: true,
    });
    expect(next.currentWeight).toBe(105);
    expect(next.failStreak).toBe(0);
  });

  it("does not change weight on a single miss, just increments the streak", () => {
    const next = nextLiftState(baseState(), { completed: false });
    expect(next.currentWeight).toBe(100);
    expect(next.failStreak).toBe(1);
    expect(next.deloadCount).toBe(0);
  });

  it("resets the fail streak on any success (2 fails + 1 success = no deload)", () => {
    let state = baseState();
    state = nextLiftState(state, { completed: false }); // streak 1
    state = nextLiftState(state, { completed: false }); // streak 2
    state = nextLiftState(state, { completed: true }); // resets to 0, weight +5
    expect(state.failStreak).toBe(0);
    expect(state.deloadCount).toBe(0);
    expect(state.currentWeight).toBe(105);
  });

  it("deloads 10% after 3 consecutive misses and resets the streak", () => {
    let state = baseState();
    state = nextLiftState(state, { completed: false }); // streak 1
    state = nextLiftState(state, { completed: false }); // streak 2
    state = nextLiftState(state, { completed: false }); // streak 3 -> deload
    // 100 * 0.9 = 90, rounded to nearest 5 = 90
    expect(state.currentWeight).toBe(90);
    expect(state.failStreak).toBe(0);
    expect(state.deloadCount).toBe(1);
    expect(state.setCount).toBe(5); // first deload does not drop to 3x5
  });

  it("rounds a deload to the nearest configured increment", () => {
    let state = baseState({ currentWeight: 97, roundTo: 5 });
    for (let i = 0; i < 3; i++) {
      state = nextLiftState(state, { completed: false });
    }
    // 97 * 0.9 = 87.3 -> rounds to 85
    expect(state.currentWeight).toBe(85);
  });

  it("drops to 3x5 permanently on a second deload", () => {
    let state = baseState();
    // first deload
    for (let i = 0; i < 3; i++) {
      state = nextLiftState(state, { completed: false });
    }
    expect(state.setCount).toBe(5);
    expect(state.deloadCount).toBe(1);

    // second deload
    for (let i = 0; i < 3; i++) {
      state = nextLiftState(state, { completed: false });
    }
    expect(state.deloadCount).toBe(2);
    expect(state.setCount).toBe(3);

    // a subsequent success should not push setCount back to 5
    state = nextLiftState(state, { completed: true });
    expect(state.setCount).toBe(3);

    // and a third deload keeps setCount at 3
    for (let i = 0; i < 3; i++) {
      state = nextLiftState(state, { completed: false });
    }
    expect(state.setCount).toBe(3);
    expect(state.deloadCount).toBe(3);
  });
});
