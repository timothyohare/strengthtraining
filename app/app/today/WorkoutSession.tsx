"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  finishWorkoutSession,
  setLiftWeight,
  type FinishWorkoutResult,
  type SetResult,
} from "./actions";
import { REPS_PER_SET } from "@/lib/program-engine/workouts";
import type { WorkoutType } from "@/lib/program-engine/schedule";
import { generateWarmupSets } from "@/lib/program-engine/warmup";
import { calculatePlates } from "@/lib/program-engine/plates";
import { stepSizes, stepWeight } from "@/lib/weight-adjust";
import type { Units } from "@/lib/units";
import { nextSetState, type SetState } from "@/lib/set-tap";
import { localIsoDate } from "@/lib/dates";
import {
  parseSavedWorkout,
  restoreSets,
  restRemainingSeconds,
  type SavedWorkout,
} from "@/lib/workout-progress";

interface SessionLift {
  liftName: string;
  currentWeight: number;
  setCount: number;
  roundTo: number;
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

// localStorage can throw (private browsing, storage blocked); losing the saved
// progress then is a degrade, not a broken workout.
function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // See readStorage.
  }
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatPlates(perSide: number[], units: Units) {
  return perSide.length > 0
    ? `${perSide.join(" + ")} ${units} a side`
    : "Empty bar";
}

function WeightAdjuster({
  liftName,
  initialWeight,
  units,
  barWeight,
  availablePlates,
  onCancel,
  onSaved,
}: {
  liftName: string;
  initialWeight: number;
  units: Units;
  barWeight: number;
  availablePlates: number[];
  onCancel: () => void;
  onSaved: (weight: number) => void;
}) {
  const [weight, setWeight] = useState(initialWeight);
  // What's in the box while typing; `weight` only takes valid numbers.
  const [draft, setDraft] = useState(String(initialWeight));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { small, big } = stepSizes(availablePlates);
  const plates = calculatePlates(weight, barWeight, availablePlates);

  function step(delta: number) {
    const next = stepWeight(weight, delta, barWeight);
    setWeight(next);
    setDraft(String(next));
  }

  function type(value: string) {
    setDraft(value);
    const n = Number(value);
    if (value !== "" && Number.isFinite(n) && n > 0) setWeight(n);
  }

  async function save() {
    if (weight === initialWeight) return onCancel();
    setSaving(true);
    setError(null);
    try {
      await setLiftWeight(liftName, weight);
      onSaved(weight);
    } catch {
      setError("Couldn\u2019t save. Check your connection and try again.");
      setSaving(false);
    }
  }

  const stepButton =
    "rounded-2xl border-2 border-line py-5 font-display text-2xl font-extrabold tabular-nums active:scale-95 transition-transform";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust ${liftName} weight`}
      className="fixed inset-0 z-30 flex flex-col bg-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Working weight
          </p>
          <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide">
            {liftName}
          </h2>
        </div>

        <div className="flex flex-col items-center gap-2">
          <label className="flex items-baseline justify-center gap-2">
            <span className="sr-only">Weight in {units}</span>
            <input
              type="number"
              inputMode="decimal"
              step={small}
              min={barWeight}
              value={draft}
              onChange={(e) => type(e.target.value)}
              onBlur={() => setDraft(String(weight))}
              // Sized to the digits (tabular, so "0"-wide) so the unit sits
              // right beside the number and "148.75" isn't clipped.
              style={{ width: `${Math.max(draft.length, 2) + 0.5}ch` }}
              className="bg-transparent text-center font-display text-8xl font-extrabold leading-none tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="font-display text-3xl font-bold text-muted">
              {units}
            </span>
          </label>
          <p className="text-sm text-muted">
            {formatPlates(plates.perSide, units)}
            {plates.achievedWeight !== weight &&
              ` (loads ${plates.achievedWeight} ${units})`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => step(-small)} className={stepButton}>
            &minus;{small}
          </button>
          <button type="button" onClick={() => step(small)} className={stepButton}>
            +{small}
          </button>
          <button type="button" onClick={() => step(-big)} className={stepButton}>
            &minus;{big}
          </button>
          <button type="button" onClick={() => step(big)} className={stepButton}>
            +{big}
          </button>
        </div>

        {weight !== initialWeight && (
          <p className="text-center text-sm text-muted tabular-nums">
            Was {initialWeight} {units}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-center text-sm text-miss">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-2xl bg-volt py-4 font-display text-xl font-bold uppercase tracking-wider text-volt-ink disabled:bg-surface-2 disabled:text-muted"
          >
            {saving ? "Saving…" : "Save weight"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-2xl border border-line py-3.5 font-semibold text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Rendered in the browser only (see WorkoutSessionLoader), so state can be
 * restored from localStorage on first render.
 */
export function WorkoutSession({
  userId,
  workoutType,
  sessionId: freshSessionId,
  units,
  restSeconds,
  barWeight,
  availablePlates,
  lifts: initialLifts,
}: {
  userId: string;
  workoutType: WorkoutType;
  sessionId: string;
  units: Units;
  restSeconds: number;
  barWeight: number;
  availablePlates: number[];
  lifts: SessionLift[];
}) {
  // Local copy so a weight changed mid-workout shows straight away without
  // re-rendering the page (which would reset the logged sets).
  const [lifts, setLifts] = useState(initialLifts);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const router = useRouter();
  const storageKey = `lift5:workout:${userId}`;
  // Today's workout in progress, if this browser was already part way
  // through it -- e.g. after a trip to Settings or iOS unloading the tab.
  const [saved] = useState(() =>
    parseSavedWorkout(readStorage(storageKey), {
      date: localIsoDate(new Date()),
      workoutType,
    }),
  );
  const sessionId = saved?.sessionId ?? freshSessionId;
  const [sets, setSets] = useState<Record<string, SetState>>(() =>
    restoreSets(initialLifts, saved?.sets),
  );
  const [restEndsAt, setRestEndsAt] = useState<number | null>(
    saved?.restEndsAt ?? null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<FinishWorkoutResult | null>(null);
  const restRemaining =
    restEndsAt === null ? null : restRemainingSeconds(restEndsAt, now);

  useEffect(() => {
    if (restEndsAt === null) return;
    const endsAt = restEndsAt;
    function tick() {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        // Only beep if we saw it end. Coming back to the app long after it
        // ran out (the page was hidden and paused) shouldn't go off late.
        if (t - endsAt < 5000) playBeep();
        setRestEndsAt(null);
      }
    }
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [restEndsAt]);

  useEffect(() => {
    if (summary) {
      writeStorage(storageKey, null);
      return;
    }
    const progress: SavedWorkout = {
      date: localIsoDate(new Date()),
      workoutType,
      sessionId,
      sets,
      restEndsAt,
    };
    writeStorage(storageKey, JSON.stringify(progress));
  }, [storageKey, workoutType, sessionId, sets, restEndsAt, summary]);

  function startRest(seconds: number) {
    const t = Date.now();
    setNow(t);
    setRestEndsAt(t + seconds * 1000);
  }

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
    if (current.status === "pending") startRest(restSeconds);
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
      date: localIsoDate(new Date()),
      sessionId,
      results,
    });
    setRestEndsAt(null);
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

  const adjustingLift = lifts.find((l) => l.liftName === adjusting);
  if (adjustingLift) {
    return (
      <WeightAdjuster
        liftName={adjustingLift.liftName}
        initialWeight={adjustingLift.currentWeight}
        units={units}
        barWeight={barWeight}
        availablePlates={availablePlates}
        onCancel={() => setAdjusting(null)}
        onSaved={(weight) => {
          setLifts((prev) =>
            prev.map((l) =>
              l.liftName === adjustingLift.liftName
                ? { ...l, currentWeight: weight }
                : l,
            ),
          );
          setAdjusting(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Tap a circle when you finish a set. Missed reps? Tap again to take one
        off.
      </p>

      {lifts.map((lift) => {
        const platesPerSide = calculatePlates(
          lift.currentWeight,
          barWeight,
          availablePlates,
        ).perSide;
        const warmups = generateWarmupSets(
          lift.currentWeight,
          barWeight,
          lift.roundTo,
        );
        return (
          <section key={lift.liftName} className="rounded-2xl bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                {lift.liftName}
              </h2>
              <button
                type="button"
                onClick={() => setAdjusting(lift.liftName)}
                aria-label={`${lift.liftName}: ${lift.currentWeight} ${units}. Tap to adjust`}
                className="-m-2 rounded-xl p-2 font-display text-4xl font-extrabold leading-none tabular-nums underline decoration-line decoration-2 underline-offset-4 active:bg-surface-2"
              >
                {lift.currentWeight}
                <span className="ml-1 text-lg font-bold text-muted">{units}</span>
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {lift.setCount}&times;{REPS_PER_SET} &middot;{" "}
              {formatPlates(platesPerSide, units)}
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

            {warmups.length > 0 && (
              <details className="group mt-4 text-sm">
                <summary className="cursor-pointer list-none text-muted">
                  <span className="inline-block transition-transform group-open:rotate-90">
                    &rsaquo;
                  </span>{" "}
                  Warm-up sets
                </summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {warmups.map((w, i) => (
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
        );
      })}

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
                  onClick={() => startRest((restRemaining ?? 0) + 30)}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={() => setRestEndsAt(null)}
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
