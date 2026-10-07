"use client";

import dynamic from "next/dynamic";

// Browser-only so WorkoutSession can restore a workout in progress from
// localStorage in its first render, without the server-rendered HTML (which
// can't see localStorage) disagreeing with it.
export const WorkoutSessionLoader = dynamic(
  () => import("./WorkoutSession").then((m) => m.WorkoutSession),
  { ssr: false },
);
