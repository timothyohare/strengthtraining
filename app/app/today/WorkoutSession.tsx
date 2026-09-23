"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishWorkoutSession, type SetResult } from "./actions";
import { REPS_PER_SET } from "@/lib/program-engine/workouts";
import type { WorkoutType } from "@/lib/program-engine/schedule";

const REST_SECONDS = 180;

interface SessionLift {
  liftName: string;
  currentWeight: number;
  setCount: number;
}

interface SetState {
  status: "pending" | "logged";
  completed: boolean;
  actualReps: number;
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

export function WorkoutSession({
  workoutType,
  date,
  sessionId,
  lifts,
}: {
  workoutType: WorkoutType;
  date: string;
  sessionId: string;
  lifts: SessionLift[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState<Record<string, SetState>>(() => {
    const initial: Record<string, SetState> = {};
    for (const lift of lifts) {
      for (let n = 1; n <= lift.setCount; n++) {
        initial[`${lift.liftName}#${n}`] = {
          status: "pending",
          completed: true,
          actualReps: REPS_PER_SET,
        };
      }
    }
    return initial;
  });
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
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

  const allLogged = useMemo(
    () => Object.values(sets).every((s) => s.status === "logged"),
    [sets],
  );

  function logSet(
    key: string,
    completed: boolean,
    actualReps: number = completed ? REPS_PER_SET : REPS_PER_SET - 1,
  ) {
    setSets((prev) => ({
      ...prev,
      [key]: { status: "logged", completed, actualReps },
    }));
    setRestRemaining(REST_SECONDS);
  }

  function adjustReps(key: string, delta: number) {
    setSets((prev) => {
      const current = prev[key];
      const actualReps = Math.min(
        REPS_PER_SET,
        Math.max(0, current.actualReps + delta),
      );
      return { ...prev, [key]: { ...current, actualReps } };
    });
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

    await finishWorkoutSession({ workoutType, date, sessionId, results });
    router.push("/today");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {restRemaining !== null && restRemaining > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded bg-black px-4 py-3 text-white">
          <span className="text-lg font-semibold tabular-nums">
            Rest: {Math.floor(restRemaining / 60)}:
            {String(restRemaining % 60).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => setRestRemaining(null)}
            className="rounded border border-white/40 px-3 py-1 text-sm"
          >
            Skip
          </button>
        </div>
      )}

      {lifts.map((lift) => (
        <section
          key={lift.liftName}
          className="rounded border border-neutral-200 p-4"
        >
          <h3 className="font-semibold">
            {lift.liftName} — {lift.currentWeight} lb
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: lift.setCount }, (_, i) => i + 1).map(
              (setNumber) => {
                const key = `${lift.liftName}#${setNumber}`;
                const s = sets[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="w-16 text-sm text-neutral-500">
                      Set {setNumber}
                    </span>
                    {s.status === "pending" ? (
                      <div className="flex flex-1 gap-2">
                        <button
                          type="button"
                          onClick={() => logSet(key, true)}
                          className="flex-1 rounded bg-green-600 py-3 text-base font-semibold text-white"
                        >
                          Hit {REPS_PER_SET}
                        </button>
                        <button
                          type="button"
                          onClick={() => logSet(key, false)}
                          className="flex-1 rounded bg-red-600 py-3 text-base font-semibold text-white"
                        >
                          Missed
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-end gap-2">
                        <span
                          className={
                            s.completed
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {s.actualReps} rep{s.actualReps === 1 ? "" : "s"}
                        </span>
                        {!s.completed && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => adjustReps(key, -1)}
                              className="rounded border border-neutral-300 px-2 py-1"
                              aria-label="fewer reps"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustReps(key, 1)}
                              className="rounded border border-neutral-300 px-2 py-1"
                              aria-label="more reps"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>
      ))}

      <button
        type="button"
        disabled={!allLogged || finishing}
        onClick={finish}
        className="rounded bg-black py-4 text-lg font-semibold text-white disabled:opacity-40"
      >
        {finishing ? "Saving…" : "Finish workout"}
      </button>
    </div>
  );
}
