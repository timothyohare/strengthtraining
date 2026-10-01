"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  finishWorkoutSession,
  type FinishWorkoutResult,
  type SetResult,
} from "./actions";
import { REPS_PER_SET } from "@/lib/program-engine/workouts";
import type { WorkoutType } from "@/lib/program-engine/schedule";
import type { WarmupSet } from "@/lib/program-engine/warmup";
import type { Units } from "@/lib/units";
import { nextSetState, PENDING_SET, type SetState } from "@/lib/set-tap";

interface SessionLift {
  liftName: string;
  currentWeight: number;
  setCount: number;
  platesPerSide: number[];
  warmups: WarmupSet[];
}

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // Best-effort -- silence is an acceptable degrade, not a broken app.
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatPlates(perSide: number[], units: Units) {
  return perSide.length > 0
    ? `${perSide.join(" + ")} ${units} a side`
    : "Empty bar";
}

export function WorkoutSession({
  workoutType,
  date,
  sessionId,
  units,
  restSeconds,
  lifts,
}: {
  workoutType: WorkoutType;
  date: string;
  sessionId: string;
  units: Units;
  restSeconds: number;
  lifts: SessionLift[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState<Record<string, SetState>>(() => {
    const initial: Record<string, SetState> = {};
    for (const lift of lifts) {
      for (let n = 1; n <= lift.setCount; n++) {
        initial[`${lift.liftName}#${n}`] = PENDING_SET;
      }
    }
    return initial;
  });
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<FinishWorkoutResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining === 0) {
      playBeep();
      return;
    }
    timerRef.current = setTimeout(() => {
      setRestRemaining((r) => (r === null ? null : r - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [restRemaining]);

  const setList = Object.values(sets);
  const loggedCount = setList.filter((s) => s.status === "logged").length;
  const allLogged = useMemo(
    () => Object.values(sets).every((s) => s.status === "logged"),
    [sets],
  );

  function tapSet(key: string) {
    const current = sets[key];
    setSets((prev) => ({ ...prev, [key]: nextSetState(prev[key]) }));
    // Only a newly logged set starts the rest clock; correcting the rep count
    // on a set already logged shouldn't restart it.
    if (current.status === "pending") setRestRemaining(restSeconds);
  }

  async function finish() {
    setFinishing(true);
    const results: SetResult[] = lifts.flatMap((lift) =>
      Array.from({ length: lift.setCount }, (_, i) => i + 1).map(
        (setNumber) => {
          const s = sets[`${lift.liftName}#${setNumber}`];
          return {
            liftName: lift.liftName,
            setNumber,
            targetWeight: lift.currentWeight,
            targetReps: REPS_PER_SET,
            actualReps: s.actualReps,
            completed: s.completed,
          };
        },
      ),
    );

    const result = await finishWorkoutSession({
      workoutType,
      date,
      sessionId,
      results,
    });
    setRestRemaining(null);
    setSummary(result);
  }

  if (summary) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-volt p-5 text-volt-ink">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">
            Workout {workoutType}
          </p>
          <p className="font-display text-4xl font-extrabold uppercase leading-none">
            Done. Nice work.
          </p>
        </div>

        {summary.lifts.map((lift) => {
          const delta = lift.newWeight - lift.previousWeight;
          return (
            <section key={lift.liftName} className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl font-bold uppercase tracking-wide">
                  {lift.liftName}
                </h3>
                <span className="text-sm text-muted tabular-nums">
                  {lift.setsCompleted}/{lift.totalSets} sets
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-display text-2xl font-bold text-muted tabular-nums">
                  {lift.previousWeight}
                </span>
                <span aria-hidden="true" className="text-muted">
                  &rarr;
                </span>
                <span className="font-display text-3xl font-extrabold tabular-nums">
                  {lift.newWeight}
                  <span className="ml-1 text-base text-muted">{units}</span>
                </span>
                {delta !== 0 && (
                  <span
                    className={`ml-auto rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
                      delta > 0
                        ? "bg-volt/15 text-volt"
                        : "bg-miss/15 text-miss"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta} {units}
                  </span>
                )}
              </div>
              {lift.deloaded && (
                <p className="mt-2 text-sm text-miss">
                  Deloaded after 3 missed sessions
                  {lift.setCountDropped ? " — now 3 sets" : ""}
                </p>
              )}
            </section>
          );
        })}

        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-2xl bg-ink py-4 font-display text-xl font-bold uppercase tracking-wider text-bg"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Tap a circle when you finish a set. Missed reps? Tap again to take one
        off.
      </p>

      {lifts.map((lift) => (
        <section key={lift.liftName} className="rounded-2xl bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
              {lift.liftName}
            </h2>
            <p className="font-display text-4xl font-extrabold leading-none tabular-nums">
              {lift.currentWeight}
              <span className="ml-1 text-lg font-bold text-muted">{units}</span>
            </p>
          </div>
          <p className="mt-1 text-sm text-muted">
            {lift.setCount}&times;{REPS_PER_SET} &middot;{" "}
            {formatPlates(lift.platesPerSide, units)}
          </p>

          <div className="mt-4 grid grid-cols-5 gap-2.5">
            {Array.from({ length: lift.setCount }, (_, i) => i + 1).map(
              (setNumber) => {
                const key = `${lift.liftName}#${setNumber}`;
                const s = sets[key];
                const style =
                  s.status === "pending"
                    ? "border-2 border-line text-muted/60"
                    : s.completed
                      ? "bg-volt text-volt-ink"
                      : "border-2 border-miss bg-miss/15 text-miss";
                const state =
                  s.status === "pending"
                    ? "not done"
                    : `${s.actualReps} rep${s.actualReps === 1 ? "" : "s"}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => tapSet(key)}
                    aria-label={`${lift.liftName} set ${setNumber}: ${state}`}
                    className={`flex aspect-square w-full items-center justify-center rounded-full font-display text-2xl font-extrabold tabular-nums transition-transform active:scale-90 ${style}`}
                  >
                    {s.actualReps}
                  </button>
                );
              },
            )}
          </div>

          {lift.warmups.length > 0 && (
            <details className="group mt-4 text-sm">
              <summary className="cursor-pointer list-none text-muted">
                <span className="inline-block transition-transform group-open:rotate-90">
                  &rsaquo;
                </span>{" "}
                Warm-up sets
              </summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {lift.warmups.map((w, i) => (
                  <li
                    key={i}
                    className="rounded-full bg-surface-2 px-3 py-1 tabular-nums"
                  >
                    {w.weight} {units} &times; {w.reps}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}

      <button
        type="button"
        disabled={!allLogged || finishing}
        onClick={finish}
        className="rounded-2xl bg-volt py-4 font-display text-xl font-bold uppercase tracking-wider text-volt-ink disabled:bg-surface-2 disabled:text-muted"
      >
        {finishing
          ? "Saving…"
          : allLogged
            ? "Finish workout"
            : `${loggedCount} of ${setList.length} sets logged`}
      </button>

      {restRemaining !== null && restRemaining > 0 && (
        <div aria-hidden="true" className="h-20" />
      )}

      {restRemaining !== null && restRemaining > 0 && (
        <div
          role="timer"
          aria-label="Rest timer"
          className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-4"
        >
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Rest
                </p>
                <p className="font-display text-4xl font-extrabold leading-none tabular-nums">
                  {formatClock(restRemaining)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRestRemaining((r) => (r ?? 0) + 30)}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={() => setRestRemaining(null)}
                  className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg"
                >
                  Skip
                </button>
              </div>
            </div>
            <div className="h-1 bg-line">
              <div
                className="h-full bg-volt transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${Math.min(100, (restRemaining / restSeconds) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
