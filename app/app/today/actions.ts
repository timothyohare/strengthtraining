"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getAllLifts, putLift, putSession } from "@/lib/db/schema";
import { nextLiftState } from "@/lib/program-engine/progression";
import type { WorkoutType } from "@/lib/program-engine/schedule";

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

/**
 * Persists a finished session and applies progression/deload to each lift
 * involved, per docs/prd.md §5. The userId is deliberately never taken from
 * the client -- it's derived from the verified session cookie, closing the
 * "never trust a client-supplied user_id" item from docs/todo.md §3.
 */
export async function finishWorkoutSession(input: FinishWorkoutInput) {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );
  if (!session) {
    throw new Error("Not authenticated");
  }
  const userId = session.userId;

  await putSession(userId, {
    sessionId: input.sessionId,
    date: input.date,
    workoutType: input.workoutType,
    status: "completed",
    sets: input.results,
  });

  const lifts = await getAllLifts(userId);
  const liftNames = [...new Set(input.results.map((r) => r.liftName))];

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
  }
}
