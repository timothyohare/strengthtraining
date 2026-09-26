import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getAllSessions } from "@/lib/db/schema";
import { WORKOUT_LIFTS } from "@/lib/program-engine/workouts";
import { ProgressChart } from "./ProgressChart";

const CHART_POINT_LIMIT = 30;

const ALL_LIFTS = [...new Set(Object.values(WORKOUT_LIFTS).flat())];

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  // Defensive check, same as app/today/page.tsx -- see that file's comment
  // for why this isn't left to app/proxy.ts alone.
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );

  if (!session) {
    redirect("/login");
  }

  const { lift: liftFilter } = await searchParams;
  const activeLift = Array.isArray(liftFilter) ? liftFilter[0] : liftFilter;

  const sessions = await getAllSessions(session.userId);
  const newestFirst = [...sessions].reverse();

  const visibleSessions = newestFirst
    .map((s) => ({
      ...s,
      sets: activeLift
        ? s.sets.filter((set) => set.liftName === activeLift)
        : s.sets,
    }))
    .filter((s) => s.sets.length > 0);

  const chartPoints = activeLift
    ? sessions
        .map((s) => {
          const liftSets = s.sets.filter((set) => set.liftName === activeLift);
          if (liftSets.length === 0) return null;
          return {
            date: s.date,
            weight: liftSets[0].targetWeight,
            completed: liftSets.every((set) => set.completed),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .slice(-CHART_POINT_LIMIT)
    : [];

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">History</h1>
        <Link
          href="/today"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Back to today
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/history"
          className={`rounded px-3 py-1.5 ${
            !activeLift
              ? "bg-black text-white"
              : "border border-neutral-300"
          }`}
        >
          All lifts
        </Link>
        {ALL_LIFTS.map((name) => (
          <Link
            key={name}
            href={`/history?lift=${encodeURIComponent(name)}`}
            className={`rounded px-3 py-1.5 ${
              activeLift === name
                ? "bg-black text-white"
                : "border border-neutral-300"
            }`}
          >
            {name}
          </Link>
        ))}
      </div>

      {activeLift && <ProgressChart liftName={activeLift} points={chartPoints} />}

      {visibleSessions.length === 0 ? (
        <p className="text-neutral-500">
          {activeLift
            ? `No logged sessions for ${activeLift} yet.`
            : "No logged sessions yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleSessions.map((s) => (
            <section
              key={s.sessionId}
              className="rounded border border-neutral-200 p-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{s.date}</h2>
                <span className="text-sm text-neutral-500">
                  Workout {s.workoutType}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {[...new Set(s.sets.map((set) => set.liftName))].map(
                  (liftName) => {
                    const liftSets = s.sets.filter(
                      (set) => set.liftName === liftName,
                    );
                    const completedCount = liftSets.filter(
                      (set) => set.completed,
                    ).length;
                    const allCompleted = completedCount === liftSets.length;
                    return (
                      <p key={liftName}>
                        <span className="font-medium">{liftName}</span>{" "}
                        {liftSets[0].targetWeight} lb &times;{" "}
                        {liftSets.length} &mdash; {completedCount}/
                        {liftSets.length} sets
                        {!allCompleted && (
                          <span className="ml-1 text-amber-700">missed</span>
                        )}
                      </p>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
