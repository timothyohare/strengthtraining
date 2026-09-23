export interface WarmupSet {
  weight: number;
  reps: number;
}

const WARMUP_STEPS: { pct: number; reps: number }[] = [
  { pct: 0.45, reps: 5 },
  { pct: 0.65, reps: 3 },
  { pct: 0.85, reps: 2 },
];

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Generates a ramp-up sequence from an empty bar to a work weight. Steps that would
 * round to <= bar weight or >= work weight are dropped, so a lifter just starting out
 * (work weight close to the bar) doesn't get redundant/overlapping warm-up sets.
 */
export function generateWarmupSets(
  workWeight: number,
  barWeight: number,
  roundTo = 5,
): WarmupSet[] {
  const sets: WarmupSet[] = [{ weight: barWeight, reps: 5 }];

  for (const step of WARMUP_STEPS) {
    const weight = roundToNearest(workWeight * step.pct, roundTo);
    if (weight > barWeight && weight < workWeight) {
      sets.push({ weight, reps: step.reps });
    }
  }

  // Dedupe consecutive identical weights (can happen at low work weights after rounding).
  return sets.filter(
    (s, i) => i === 0 || s.weight !== sets[i - 1].weight,
  );
}
