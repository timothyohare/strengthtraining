/**
 * Seeds the default StrongLifts 5x5 program (docs/prd.md §5) for one user
 * into the real deployed DynamoDB table (infra/dynamodb.yaml). Run with:
 *   pnpm exec tsx scripts/seed.ts <userId>
 *
 * Starting weights below are the standard StrongLifts beginner defaults
 * (bar-only for press movements, bar+load for pulls) -- placeholders meant
 * to be adjusted once a Settings screen exists (docs/todo.md §6). Deadlift's
 * increment (+10lb) and single work set are the classic program's values;
 * note the deload-to-3x5 fallback in lib/program-engine/progression.ts was
 * validated for the 5-set lifts, not for deadlift's 1-set case -- a known
 * gap, see docs/todo.md.
 */
import { putLift, putProfile } from "../lib/db/schema";
import type { LiftItem } from "../lib/db/schema";

const DEFAULT_LIFTS: LiftItem[] = [
  {
    liftName: "Squat",
    currentWeight: 45,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Bench Press",
    currentWeight: 45,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Barbell Row",
    currentWeight: 65,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Overhead Press",
    currentWeight: 45,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Deadlift",
    currentWeight: 95,
    increment: 10,
    roundTo: 5,
    setCount: 1,
    failStreak: 0,
    deloadCount: 0,
  },
];

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: pnpm exec tsx scripts/seed.ts <userId>");
    process.exit(1);
  }

  await putProfile(userId, {
    displayName: userId,
    units: "lb",
    createdAt: new Date().toISOString(),
  });
  console.log(`seeded profile for ${userId}`);

  for (const lift of DEFAULT_LIFTS) {
    await putLift(userId, lift);
    console.log(`seeded lift ${lift.liftName} @ ${lift.currentWeight}lb`);
  }

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
