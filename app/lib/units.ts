export type Units = "lb" | "kg";

const KG_PER_LB = 0.45359237;

/**
 * Converts a weight value between units, rounded to the nearest 0.5 -- iron
 * plates are never loaded finer than that in either system. Used only when
 * a user actively switches units (see app/settings/actions.ts); every other
 * read/write treats stored weight fields as already being in the profile's
 * current unit, with no conversion at display time.
 */
export function convertWeight(value: number, from: Units, to: Units): number {
  if (from === to) return value;
  const kg = from === "lb" ? value * KG_PER_LB : value;
  const converted = to === "lb" ? kg / KG_PER_LB : kg;
  return Math.round(converted * 2) / 2;
}
