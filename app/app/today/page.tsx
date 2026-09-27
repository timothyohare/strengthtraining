import Link from "next/link";
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
import { REPS_PER_SET, WORKOUT_LIFTS } from "@/lib/program-engine/workouts";
import { generateWarmupSets } from "@/lib/program-engine/warmup";
import { calculatePlates } from "@/lib/program-engine/plates";
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

  const liftsForToday = WORKOUT_LIFTS[workoutType]
    .map((name) => lifts.find((l) => l.liftName === name))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Workout {workoutType}</h1>
          <p className="text-sm text-neutral-500">Signed in as {userId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            History
          </Link>
          <Link
            href="/settings"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Settings
          </Link>
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {liftsForToday.length === 0 ? (
        <p className="text-neutral-500">
          No lifts configured yet for {userId}. Seed the default program with{" "}
          <code className="rounded bg-neutral-100 px-1">
            pnpm exec tsx scripts/seed.ts {userId}
          </code>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {liftsForToday.map((lift) => {
              const warmups = generateWarmupSets(
                lift.currentWeight,
                barWeight,
                lift.roundTo,
              );
              const plates = calculatePlates(
                lift.currentWeight,
                barWeight,
                availablePlates,
              );

              return (
                <section
                  key={lift.liftName}
                  className="rounded border border-neutral-200 p-4"
                >
                  <h2 className="text-lg font-semibold">{lift.liftName}</h2>
                  <p className="text-2xl font-bold">
                    {lift.currentWeight} {units} &times; {lift.setCount}{" "}
                    &times; {REPS_PER_SET}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Plates/side:{" "}
                    {plates.perSide.length > 0
                      ? plates.perSide.join(", ")
                      : "bar only"}
                  </p>
                  <details className="mt-2 text-sm text-neutral-500">
                    <summary>Warm-up sets</summary>
                    <ul className="mt-1 list-disc pl-5">
                      {warmups.map((w, i) => (
                        <li key={i}>
                          {w.weight} {units} &times; {w.reps}
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>
              );
            })}
          </div>

          <WorkoutSession
            workoutType={workoutType}
            date={new Date().toISOString().slice(0, 10)}
            sessionId={crypto.randomUUID()}
            units={units}
            restSeconds={restTimerSeconds}
            lifts={liftsForToday.map((l) => ({
              liftName: l.liftName,
              currentWeight: l.currentWeight,
              setCount: l.setCount,
            }))}
          />
        </>
      )}
    </main>
  );
}
