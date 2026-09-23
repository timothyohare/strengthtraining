export type WorkoutType = "A" | "B";

export interface CompletedSessionSummary {
  workoutType: WorkoutType;
  date: string; // ISO date
}

/**
 * StrongLifts alternates A/B every session, regardless of what happened during the
 * session (completed or not) — the alternation is purely sequence-based.
 */
export function nextWorkoutType(
  history: CompletedSessionSummary[],
): WorkoutType {
  if (history.length === 0) return "A";
  const last = [...history].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return last.workoutType === "A" ? "B" : "A";
}
