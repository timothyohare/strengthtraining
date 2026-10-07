// Step sizes for the in-workout weight adjuster. The small step is the
// smallest change you can actually load (one smallest plate each side); the
// big step is four of those, for bigger corrections without lots of taps.
export function stepSizes(availablePlates: number[]): {
  small: number;
  big: number;
} {
  const smallest = availablePlates.length > 0 ? Math.min(...availablePlates) : 1.25;
  const small = smallest * 2;
  return { small, big: small * 4 };
}

// Rounded to 2 decimals so repeated taps of fractional steps don't drift, and
// clamped at the bar -- you can't load less than an empty bar.
export function stepWeight(weight: number, delta: number, barWeight: number) {
  return Math.max(barWeight, Math.round((weight + delta) * 100) / 100);
}
