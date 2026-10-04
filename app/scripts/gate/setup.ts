/**
 * gate-verify `setup`: creates the lift5-gate table in DynamoDB Local and
 * seeds the two users in fixtures.ts. Run by the gate, not by hand:
 *   pnpm exec tsx scripts/gate/setup.ts
 */
import {
  type DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { assertLocalGateDb } from "./guard";
import { GATE_USERS } from "./fixtures";

assertLocalGateDb();

async function waitForDynamo(client: DynamoDBClient) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      return await client.send(new ListTablesCommand({}));
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("DynamoDB Local never answered");
}

async function main() {
  // Imported after the guard so the client can't be built for the live table.
  const { ddbClient, TABLE_NAME, putLift, putProfile } = await import(
    "../../lib/db/schema"
  );

  const tables = await waitForDynamo(ddbClient);
  if (tables.TableNames?.includes(TABLE_NAME)) {
    await ddbClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
  }
  await ddbClient.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
    }),
  );

  for (const { userId, squat } of Object.values(GATE_USERS)) {
    await putProfile(userId, {
      displayName: userId,
      units: "kg",
      createdAt: new Date().toISOString(),
    });
    await putLift(userId, {
      liftName: "Squat",
      currentWeight: squat,
      increment: 2.5,
      roundTo: 2.5,
      setCount: 5,
      failStreak: 0,
      deloadCount: 0,
    });
  }
  console.log(`setup: ${TABLE_NAME} created, seeded gate-a and gate-b`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
