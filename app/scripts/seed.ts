/**
 * Seeds the default StrongLifts 5x5 program (docs/prd.md §5) for one user
 * into the real deployed DynamoDB table (infra/dynamodb.yaml). Run with:
 *   pnpm exec tsx scripts/seed.ts <userId>
 *
 * Starting weights below are the standard StrongLifts beginner defaults in kg
 * (20kg bar-only for press movements, bar+load for pulls) -- still
 * placeholders meant to be corrected via the Settings screen
 * (app/settings/page.tsx) once a real user's actual numbers are known.
 * Deadlift's increment (+5kg) and single work set are the classic program's
 * values.
 */
import { putLift, putProfile } from "../lib/db/schema";
import type { LiftItem } from "../lib/db/schema";

const DEFAULT_LIFTS: LiftItem[] = [
  {
    liftName: "Squat",
    currentWeight: 20,
    increment: 2.5,
    roundTo: 2.5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Bench Press",
    currentWeight: 20,
    increment: 2.5,
    roundTo: 2.5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Barbell Row",
    currentWeight: 30,
    increment: 2.5,
    roundTo: 2.5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Overhead Press",
    currentWeight: 20,
    increment: 2.5,
    roundTo: 2.5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  },
  {
    liftName: "Deadlift",
    currentWeight: 40,
    increment: 5,
    roundTo: 2.5,
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
    units: "kg",
    createdAt: new Date().toISOString(),
  });
  console.log(`seeded profile for ${userId}`);

  for (const lift of DEFAULT_LIFTS) {
    await putLift(userId, lift);
    console.log(`seeded lift ${lift.liftName} @ ${lift.currentWeight}kg`);
  }

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
