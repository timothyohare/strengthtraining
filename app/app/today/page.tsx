import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getAllLifts, getMostRecentSessions } from "@/lib/db/schema";
import { nextWorkoutType } from "@/lib/program-engine/schedule";
import { REPS_PER_SET, WORKOUT_LIFTS } from "@/lib/program-engine/workouts";
import { generateWarmupSets } from "@/lib/program-engine/warmup";
import { calculatePlates } from "@/lib/program-engine/plates";

// Not yet configurable (docs/todo.md §6 Settings screen) -- standard US lb
// bar + plate set, hardcoded for now.
const BAR_WEIGHT = 45;
const AVAILABLE_PLATES = [45, 35, 25, 10, 5, 2.5];

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
  const [lifts, recentSessions] = await Promise.all([
    getAllLifts(userId),
    getMostRecentSessions(userId, 1),
  ]);

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
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Log out
          </button>
        </form>
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
        <div className="flex flex-col gap-4">
          {liftsForToday.map((lift) => {
            const warmups = generateWarmupSets(
              lift.currentWeight,
              BAR_WEIGHT,
              lift.roundTo,
            );
            const plates = calculatePlates(
              lift.currentWeight,
              BAR_WEIGHT,
              AVAILABLE_PLATES,
            );

            return (
              <section
                key={lift.liftName}
                className="rounded border border-neutral-200 p-4"
              >
                <h2 className="text-lg font-semibold">{lift.liftName}</h2>
                <p className="text-2xl font-bold">
                  {lift.currentWeight} lb &times; {lift.setCount} &times;{" "}
                  {REPS_PER_SET}
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
                        {w.weight} lb &times; {w.reps}
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
