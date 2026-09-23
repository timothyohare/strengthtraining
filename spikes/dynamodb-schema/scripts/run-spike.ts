import {
  CreateTableCommand,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  ddbClient,
  getAllLifts,
  getAllSessions,
  getLiftHistory,
  getMostRecentSessions,
  getProfile,
  getRecentLiftResults,
  putLift,
  putProfile,
  putSession,
  TABLE_NAME,
} from "../src/schema.ts";

async function ensureTable() {
  try {
    await ddbClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
    console.log(`created table ${TABLE_NAME}`);
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      console.log(`table ${TABLE_NAME} already exists, reusing`);
    } else {
      throw err;
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  ok: ${message}`);
}

async function seed(userId: string) {
  await putProfile(userId, {
    displayName: "Tim",
    units: "lb",
    createdAt: "2026-01-01T00:00:00Z",
  });

  await putLift(userId, {
    liftName: "Squat",
    currentWeight: 185,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 0,
    deloadCount: 0,
  });
  await putLift(userId, {
    liftName: "Bench Press",
    currentWeight: 135,
    increment: 5,
    roundTo: 5,
    setCount: 5,
    failStreak: 1,
    deloadCount: 0,
  });

  const dates = [
    "2026-09-01",
    "2026-09-03",
    "2026-09-05",
    "2026-09-08",
    "2026-09-10",
  ];
  const workoutTypes: ("A" | "B")[] = ["A", "B", "A", "B", "A"];
  const squatWeights = [170, 175, 180, 180, 185];
  const squatCompleted = [true, true, false, true, true];

  for (let i = 0; i < dates.length; i++) {
    await putSession(userId, {
      sessionId: `sess-${i}`,
      date: dates[i],
      workoutType: workoutTypes[i],
      status: "completed",
      sets: [
        {
          liftName: "Squat",
          setNumber: 1,
          targetWeight: squatWeights[i],
          targetReps: 5,
          actualReps: squatCompleted[i] ? 5 : 3,
          completed: squatCompleted[i],
        },
      ],
    });
  }
}

async function main() {
  await ensureTable();

  const userId = "spike-user-1";
  await seed(userId);

  console.log("\n--- Access pattern: get user profile ---");
  const profile = await getProfile(userId);
  console.log(profile);
  assert(profile?.displayName === "Tim", "profile fetched by PK+SK GetItem");

  console.log("\n--- Access pattern: get all current lift states ---");
  const lifts = await getAllLifts(userId);
  console.log(lifts.map((l) => `${l.liftName}: ${l.currentWeight}`));
  assert(lifts.length === 2, "both seeded lifts returned by begins_with(LIFT#) query");

  console.log("\n--- Access pattern: most recent session (next A/B decision) ---");
  const [mostRecent] = await getMostRecentSessions(userId, 1);
  console.log(mostRecent);
  assert(
    mostRecent.date === "2026-09-10" && mostRecent.workoutType === "A",
    "ScanIndexForward=false correctly returns the newest session first",
  );

  console.log("\n--- Access pattern: full session history ---");
  const allSessions = await getAllSessions(userId);
  console.log(allSessions.map((s) => `${s.date} (${s.workoutType})`));
  assert(allSessions.length === 5, "all 5 seeded sessions returned, no GSI needed");
  assert(
    allSessions[0].date === "2026-09-01",
    "ScanIndexForward=true returns oldest-first for a chronological history view",
  );

  console.log("\n--- Access pattern: per-lift progress chart data ---");
  const squatHistory = await getLiftHistory(userId, "Squat");
  console.log(squatHistory);
  assert(
    squatHistory.length === 5 &&
      squatHistory.every((h) => typeof h.weight === "number"),
    "lift history derived by filtering embedded sets, no per-set items needed",
  );

  console.log("\n--- Access pattern: deload-streak lookup for a lift ---");
  const recentSquat = await getRecentLiftResults(userId, "Squat", 3);
  console.log(recentSquat);
  assert(recentSquat.length === 3, "returns last 3 results for the lift, newest first");
  assert(
    recentSquat[0].date === "2026-09-10",
    "most recent result is first",
  );

  console.log("\nAll access patterns served correctly with ZERO secondary indexes.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
