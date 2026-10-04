// Two users with different, unmistakable Squat weights, so a page that
// leaks the other user's data shows the wrong number.
export const GATE_USERS = {
  a: { userId: "gate-a", squat: 123.75 },
  b: { userId: "gate-b", squat: 987.5 },
} as const;
