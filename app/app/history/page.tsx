import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getAllSessions, getProfile } from "@/lib/db/schema";
import { WORKOUT_LIFTS } from "@/lib/program-engine/workouts";
import { Screen, ScreenHeader } from "../BottomNav";
import { ProgressChart } from "./ProgressChart";

const CHART_POINT_LIMIT = 30;

const ALL_LIFTS = [...new Set(Object.values(WORKOUT_LIFTS).flat())];

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  // Defensive check, same as app/today/page.tsx -- see that file's comment
  // for why this isn't left to app/proxy.ts alone.
  const session = await requireSession();

  const { lift: liftFilter } = await searchParams;
  const activeLift = Array.isArray(liftFilter) ? liftFilter[0] : liftFilter;

  const [sessions, profile] = await Promise.all([
    getAllSessions(session.userId),
    getProfile(session.userId),
  ]);
  const units = profile?.units ?? "kg";
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
    <Screen>
      <ScreenHeader eyebrow="Your training" title="History" />

      <nav
        aria-label="Filter by lift"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm"
      >
        {[{ name: "All lifts", href: "/history", active: !activeLift }]
          .concat(
            ALL_LIFTS.map((name) => ({
              name,
              href: `/history?lift=${encodeURIComponent(name)}`,
              active: activeLift === name,
            })),
          )
          .map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              aria-current={chip.active ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 font-semibold whitespace-nowrap ${
                chip.active
                  ? "bg-volt text-volt-ink"
                  : "bg-surface text-muted"
              }`}
            >
              {chip.name}
            </Link>
          ))}
      </nav>

      {activeLift && (
        <ProgressChart liftName={activeLift} points={chartPoints} units={units} />
      )}

      {visibleSessions.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-muted">
          {activeLift
            ? `No logged sessions for ${activeLift} yet.`
            : "No workouts logged yet. Your first one will show up here."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleSessions.map((s) => (
            <section key={s.sessionId} className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                  {new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
                  Workout {s.workoutType}
                </span>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {[...new Set(s.sets.map((set) => set.liftName))].map(
                  (liftName) => {
                    const liftSets = s.sets.filter(
                      (set) => set.liftName === liftName,
                    );
                    return (
                      <li
                        key={liftName}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{liftName}</p>
                          <p className="text-sm text-muted tabular-nums">
                            {liftSets[0].targetWeight} {units}
                          </p>
                        </div>
                        <div
                          className="flex gap-1"
                          aria-label={`${liftSets.filter((set) => set.completed).length} of ${liftSets.length} sets completed`}
                        >
                          {liftSets.map((set) => (
                            <span
                              key={set.setNumber}
                              aria-hidden="true"
                              className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-bold tabular-nums ${
                                set.completed
                                  ? "bg-volt text-volt-ink"
                                  : "border border-miss bg-miss/15 text-miss"
                              }`}
                            >
                              {set.actualReps}
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}
