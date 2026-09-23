export interface PlateResult {
  /** Plates for one side of the bar, largest first. Assumes unlimited quantity of each size. */
  perSide: number[];
  /** The actual total bar weight achieved — may differ from the target if not exactly loadable. */
  achievedWeight: number;
}

const EPSILON = 1e-6;

/**
 * Computes plates-per-side for a target total weight. Greedily loads largest-first
 * without exceeding the per-side target, then checks whether adding one more of the
 * smallest available plate would land *closer* to the target (overshoot beats a bigger
 * undershoot) — e.g. target diff 7 with [5, 2.5] plates: 5+2.5=7.5 (off by 0.5) beats
 * 5 alone (off by 2).
 */
export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): PlateResult {
  if (targetWeight <= barWeight) {
    return { perSide: [], achievedWeight: barWeight };
  }

  const sorted = [...availablePlates].sort((a, b) => b - a);
  const perSideTarget = (targetWeight - barWeight) / 2;

  let remaining = perSideTarget;
  const used: number[] = [];

  for (const plate of sorted) {
    while (remaining >= plate - EPSILON) {
      used.push(plate);
      remaining -= plate;
    }
  }

  const smallest = sorted[sorted.length - 1];
  if (smallest !== undefined && remaining > EPSILON) {
    const undershoot = remaining;
    const overshoot = Math.abs(remaining - smallest);
    if (overshoot < undershoot) {
      used.push(smallest);
      remaining -= smallest;
    }
  }

  const achievedPerSide = perSideTarget - remaining;
  const achievedWeight =
    Math.round((barWeight + 2 * achievedPerSide) * 100) / 100;

  return {
    perSide: used.sort((a, b) => b - a),
    achievedWeight,
  };
}
