"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getAllLifts, putLift, putSession } from "@/lib/db/schema";
import { nextLiftState } from "@/lib/program-engine/progression";
import type { WorkoutType } from "@/lib/program-engine/schedule";
import { isIsoDate } from "@/lib/dates";

export interface SetResult {
  liftName: string;
  setNumber: number;
  targetWeight: number;
  targetReps: number;
  actualReps: number;
  completed: boolean;
}

export interface FinishWorkoutInput {
  workoutType: WorkoutType;
  date: string;
  sessionId: string;
  results: SetResult[];
}

export interface LiftSummary {
  liftName: string;
  previousWeight: number;
  newWeight: number;
  setsCompleted: number;
  totalSets: number;
  deloaded: boolean;
  setCountDropped: boolean;
}

export interface FinishWorkoutResult {
  lifts: LiftSummary[];
}

/**
 * Persists a finished session and applies progression/deload to each lift
 * involved, per docs/prd.md §5. The userId is deliberately never taken from
 * the client -- it's derived from the verified session cookie, closing the
 * "never trust a client-supplied user_id" item from docs/todo.md §3.
 */
export async function finishWorkoutSession(
  input: FinishWorkoutInput,
): Promise<FinishWorkoutResult> {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );
  if (!session) {
    throw new Error("Not authenticated");
  }
  const userId = session.userId;
  // The date comes from the client (it's the lifter's local date) and goes
  // into the sort key, so reject anything that isn't a real YYYY-MM-DD.
  if (!isIsoDate(input.date)) {
    throw new Error("Invalid workout date");
  }

  await putSession(userId, {
    sessionId: input.sessionId,
    date: input.date,
    completedAt: new Date().toISOString(),
    workoutType: input.workoutType,
    status: "completed",
    sets: input.results,
  });

  const lifts = await getAllLifts(userId);
  const liftNames = [...new Set(input.results.map((r) => r.liftName))];
  const summaries: LiftSummary[] = [];

  for (const liftName of liftNames) {
    const lift = lifts.find((l) => l.liftName === liftName);
    if (!lift) continue;

    const setsForLift = input.results.filter((r) => r.liftName === liftName);
    const liftCompleted = setsForLift.every((s) => s.completed);

    const updated = nextLiftState(
      { name: lift.liftName, ...lift },
      { completed: liftCompleted },
    );
    await putLift(userId, {
      liftName: lift.liftName,
      currentWeight: updated.currentWeight,
      increment: updated.increment,
      roundTo: updated.roundTo,
      setCount: updated.setCount,
      failStreak: updated.failStreak,
      deloadCount: updated.deloadCount,
    });

    summaries.push({
      liftName: lift.liftName,
      previousWeight: lift.currentWeight,
      newWeight: updated.currentWeight,
      setsCompleted: setsForLift.filter((s) => s.completed).length,
      totalSets: setsForLift.length,
      deloaded: updated.deloadCount > lift.deloadCount,
      setCountDropped: updated.setCount < lift.setCount,
    });
  }

  return { lifts: summaries };
}
