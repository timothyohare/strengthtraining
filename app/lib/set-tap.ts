import { REPS_PER_SET } from "./program-engine/workouts";

export interface SetState {
  status: "pending" | "logged";
  completed: boolean;
  actualReps: number;
}

export const PENDING_SET: SetState = {
  status: "pending",
  completed: true,
  actualReps: REPS_PER_SET,
};

// StrongLifts-style tap cycle: first tap logs a full set, each further tap
// takes a rep off (a missed set), and tapping at 0 clears the set again.
export function nextSetState(s: SetState): SetState {
  if (s.status === "pending") {
    return { status: "logged", completed: true, actualReps: REPS_PER_SET };
  }
  if (s.actualReps === 0) return PENDING_SET;
  return { status: "logged", completed: false, actualReps: s.actualReps - 1 };
}
