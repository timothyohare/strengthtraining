import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export const TABLE_NAME = "Lift5";

export const ddbClient = new DynamoDBClient({
  region: "local",
  endpoint: process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8811",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

export const ddb = DynamoDBDocumentClient.from(ddbClient);

// ---- Key helpers -----------------------------------------------------

export const userPk = (userId: string) => `USER#${userId}`;
export const profileSk = () => "PROFILE";
export const liftSk = (liftName: string) => `LIFT#${liftName}`;
export const sessionSk = (isoDate: string, sessionId: string) =>
  `SESSION#${isoDate}#${sessionId}`;

// ---- Item shapes -------------------------------------------------------

export interface ProfileItem {
  displayName: string;
  units: "lb" | "kg";
  createdAt: string;
}

export interface LiftItem {
  liftName: string;
  currentWeight: number;
  increment: number;
  roundTo: number;
  setCount: number;
  failStreak: number;
  deloadCount: number;
}

export interface SessionSet {
  liftName: string;
  setNumber: number;
  targetWeight: number;
  targetReps: number;
  actualReps: number;
  completed: boolean;
}

export interface SessionItem {
  sessionId: string;
  date: string; // ISO date
  workoutType: "A" | "B";
  status: "completed" | "in_progress";
  sets: SessionSet[];
}

// ---- Access patterns -----------------------------------------------------
// Every pattern below is exercised for real in scripts/run-spike.ts against
// DynamoDB Local -- this is not just a design doc.

export async function putProfile(userId: string, profile: ProfileItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: profileSk(), ...profile },
    }),
  );
}

export async function getProfile(userId: string) {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: profileSk() },
    }),
  );
  return res.Item as (ProfileItem & { PK: string; SK: string }) | undefined;
}

export async function putLift(userId: string, lift: LiftItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: liftSk(lift.liftName), ...lift },
    }),
  );
}

/** Access pattern: "get today's targets" needs every lift's current state. */
export async function getAllLifts(userId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": userPk(userId), ":prefix": "LIFT#" },
    }),
  );
  return (res.Items ?? []) as (LiftItem & { PK: string; SK: string })[];
}

export async function putSession(userId: string, session: SessionItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: userPk(userId),
        SK: sessionSk(session.date, session.sessionId),
        ...session,
      },
    }),
  );
}

/** Access pattern: "what workout is next" needs only the single most recent session. */
export async function getMostRecentSessions(userId: string, limit: number) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":prefix": "SESSION#",
      },
      ScanIndexForward: false, // newest first, since SK embeds an ISO date
      Limit: limit,
    }),
  );
  return (res.Items ?? []) as (SessionItem & { PK: string; SK: string })[];
}

/** Access pattern: full history / progress charts. No GSI needed at this scale. */
export async function getAllSessions(userId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":prefix": "SESSION#",
      },
      ScanIndexForward: true,
    }),
  );
  return (res.Items ?? []) as (SessionItem & { PK: string; SK: string })[];
}

/**
 * Access pattern: per-lift weight history for a progress chart. Reuses the
 * "all sessions" query and filters/maps in application code -- deliberately
 * not a separate GSI, since a personal-scale history (a few hundred sessions
 * a year) is trivial to filter in memory.
 */
export async function getLiftHistory(userId: string, liftName: string) {
  const sessions = await getAllSessions(userId);
  return sessions.flatMap((session) =>
    session.sets
      .filter((s) => s.liftName === liftName)
      .map((s) => ({
        date: session.date,
        weight: s.targetWeight,
        completed: s.completed,
      })),
  );
}

/**
 * Access pattern: deload-streak lookup for a specific lift needs the last
 * few sessions' results for that lift, most recent first.
 */
export async function getRecentLiftResults(
  userId: string,
  liftName: string,
  count: number,
) {
  const recent = await getMostRecentSessions(userId, 10); // small over-fetch, filtered below
  const results: { date: string; completed: boolean }[] = [];
  for (const session of recent) {
    const setsForLift = session.sets.filter((s) => s.liftName === liftName);
    if (setsForLift.length === 0) continue;
    results.push({
      date: session.date,
      completed: setsForLift.every((s) => s.completed),
    });
    if (results.length >= count) break;
  }
  return results;
}
