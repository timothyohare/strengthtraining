import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  DEFAULT_SETTINGS,
  getAllLifts,
  getMostRecentSessions,
  getProfile,
  getSettings,
} from "@/lib/db/schema";
import { nextWorkoutType } from "@/lib/program-engine/schedule";
import { WORKOUT_LIFTS } from "@/lib/program-engine/workouts";
import { generateWarmupSets } from "@/lib/program-engine/warmup";
import { calculatePlates } from "@/lib/program-engine/plates";
import { Screen, ScreenHeader } from "../BottomNav";
import { WorkoutSession } from "./WorkoutSession";

export default async function TodayPage() {
  // Defensive check, not just relying on proxy.ts -- Next's own guidance is
  // that a matcher change could silently remove Proxy coverage, so every
  // protected page verifies its own session too.
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );

  if (!session) {
    redirect("/login");
  }

  const userId = session.userId;
  const [lifts, recentSessions, profile, settings] = await Promise.all([
    getAllLifts(userId),
    getMostRecentSessions(userId, 1),
    getProfile(userId),
    getSettings(userId),
  ]);

  const units = profile?.units ?? "kg";
  const { barWeight, availablePlates, restTimerSeconds } =
    settings ?? DEFAULT_SETTINGS;

  const workoutType = nextWorkoutType(
    recentSessions.map((s) => ({ workoutType: s.workoutType, date: s.date })),
  );

  // Fresh per render, and used as the WorkoutSession key: after a workout is
  // saved, router.refresh() re-renders this page with a new id, which remounts
  // the session instead of leaving the old summary on screen.
  const sessionId = crypto.randomUUID();

  const liftsForToday = WORKOUT_LIFTS[workoutType]
    .map((name) => lifts.find((l) => l.liftName === name))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Next up"
        title={`Workout ${workoutType}`}
      />

      {liftsForToday.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-muted">
          No lifts set up yet for {userId}. Seed the default program with{" "}
          <code className="rounded bg-surface-2 px-1 text-ink">
            pnpm exec tsx scripts/seed.ts {userId}
          </code>
          .
        </p>
      ) : (
        <WorkoutSession
          key={sessionId}
          workoutType={workoutType}
          date={new Date().toISOString().slice(0, 10)}
          sessionId={sessionId}
          units={units}
          restSeconds={restTimerSeconds}
          lifts={liftsForToday.map((lift) => ({
            liftName: lift.liftName,
            currentWeight: lift.currentWeight,
            setCount: lift.setCount,
            platesPerSide: calculatePlates(
              lift.currentWeight,
              barWeight,
              availablePlates,
            ).perSide,
            warmups: generateWarmupSets(
              lift.currentWeight,
              barWeight,
              lift.roundTo,
            ),
          }))}
        />
      )}
    </Screen>
  );
}
