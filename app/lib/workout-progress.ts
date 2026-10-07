import type { WorkoutType } from "./program-engine/schedule";
import { PENDING_SET, type SetState } from "./set-tap";

/**
 * A workout in progress, kept in the browser's localStorage so the logged
 * sets survive leaving /today (Settings, a reload, or iOS unloading a
 * background tab). Only today's workout of the same type is restored.
 */
export interface SavedWorkout {
  date: string;
  workoutType: WorkoutType;
  sessionId: string;
  sets: Record<string, SetState>;
  /** Unix ms the rest timer ends, or null when it isn't running. */
  restEndsAt: number | null;
}

export function parseSavedWorkout(
  raw: string | null,
  current: { date: string; workoutType: WorkoutType },
): SavedWorkout | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<SavedWorkout>;
    if (
      saved.date !== current.date ||
      saved.workoutType !== current.workoutType ||
      typeof saved.sessionId !== "string" ||
      typeof saved.sets !== "object" ||
      saved.sets === null
    ) {
      return null;
    }
    return {
      date: saved.date,
      workoutType: saved.workoutType,
      sessionId: saved.sessionId,
      sets: saved.sets,
      restEndsAt: typeof saved.restEndsAt === "number" ? saved.restEndsAt : null,
    };
  } catch {
    return null;
  }
}

export function restoreSets(
  lifts: { liftName: string; setCount: number }[],
  saved: Record<string, SetState> | undefined,
): Record<string, SetState> {
  const sets: Record<string, SetState> = {};
  for (const lift of lifts) {
    for (let n = 1; n <= lift.setCount; n++) {
      const key = `${lift.liftName}#${n}`;
      sets[key] = saved?.[key] ?? PENDING_SET;
    }
  }
  return sets;
}

// Worked out from the clock rather than counted down tick by tick: iOS pauses
// timers on a hidden page, so a tick count falls behind real time.
export function restRemainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
