import type { WorkoutType } from "./schedule";

/**
 * Which lifts appear in each workout, per the classic StrongLifts 5x5 split
 * (docs/prd.md §5). Not part of the original spike (spikes/program-engine
 * only covered per-lift progression math) -- this is the composition rule
 * that maps a workout type to its lifts, added while wiring real data.
 */
export const WORKOUT_LIFTS: Record<WorkoutType, string[]> = {
  A: ["Squat", "Bench Press", "Barbell Row"],
  B: ["Squat", "Overhead Press", "Deadlift"],
};

export const REPS_PER_SET = 5;
