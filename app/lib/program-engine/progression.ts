export interface LiftState {
  name: string;
  currentWeight: number;
  increment: number;
  /** Round weights (e.g. after a deload) to the nearest multiple of this. */
  roundTo: number;
  // Not strictly 5|3: Deadlift's classic program uses a single work set (1).
  // See docs/todo.md §2 "known gap" -- the double-deload fallback below
  // assumes a 5-set lift and isn't correct for Deadlift yet.
  setCount: number;
  /** Consecutive failed sessions on this lift, resets on any success. */
  failStreak: number;
  /** How many times this lift has been deloaded, ever. */
  deloadCount: number;
}

export interface SessionResult {
  /** true only if every set hit its target reps. */
  completed: boolean;
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Applies one session's result to a lift's state, producing the state to use for the
 * *next* time this lift is programmed. Rules (per prd.md #5):
 *  - full completion -> weight increases by `increment`, fail streak resets
 *  - a miss -> fail streak +1; on the 3rd consecutive miss, deload 10% and reset streak
 *  - a 2nd deload (ever) on this lift permanently drops it from 5x5 to 3x5
 */
export function nextLiftState(
  state: LiftState,
  result: SessionResult,
): LiftState {
  if (result.completed) {
    return {
      ...state,
      currentWeight: state.currentWeight + state.increment,
      failStreak: 0,
    };
  }

  const failStreak = state.failStreak + 1;

  if (failStreak < 3) {
    return { ...state, failStreak };
  }

  const deloadCount = state.deloadCount + 1;
  const deloadedWeight = roundToNearest(
    state.currentWeight * 0.9,
    state.roundTo,
  );

  return {
    ...state,
    currentWeight: deloadedWeight,
    failStreak: 0,
    deloadCount,
    setCount: deloadCount >= 2 ? 3 : state.setCount,
  };
}
