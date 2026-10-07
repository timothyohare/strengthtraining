import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * Ported from spikes/dynamodb-schema/src/schema.ts (docs/spikes.md Spike 2) --
 * table design and every access pattern below were already validated live
 * against DynamoDB Local before this port. The only change from the spike is
 * the client config: this points at the real deployed table
 * (infra/dynamodb.yaml, stack lift5-dynamodb) via the default AWS SDK
 * credential chain, instead of the spike's hardcoded local endpoint/creds.
 *
 * Local dev: uses your ambient AWS CLI credentials (same ones `aws` commands
 * use), so `pnpm dev` reads/writes the real `lift5-dev` table. Production
 * (Amplify Hosting) will need its own IAM permissions for this table on the
 * app's compute role -- not yet configured, see docs/todo.md #1.
 */

export const TABLE_NAME = process.env.DYNAMODB_TABLE ?? "lift5-dev";

export const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
  // Only set for local testing against DynamoDB Local (matches the spike);
  // unset in every real environment, so the default credential chain and
  // real DynamoDB endpoint are used.
  ...(process.env.DYNAMODB_ENDPOINT
    ? {
        endpoint: process.env.DYNAMODB_ENDPOINT,
        credentials: { accessKeyId: "local", secretAccessKey: "local" },
      }
    : {}),
});

export const ddb = DynamoDBDocumentClient.from(ddbClient);

// ---- Key helpers -----------------------------------------------------

export const userPk = (userId: string) => `USER#${userId}`;
export const profileSk = () => "PROFILE";
export const liftSk = (liftName: string) => `LIFT#${liftName}`;
export const settingsSk = () => "SETTINGS";
// One per device that turned on rest alerts, keyed by a hash of its push
// endpoint (endpoints are long URLs). Read by lambda/rest-push too.
export const pushSubSk = (endpointHash: string) => `PUSHSUB#${endpointHash}`;
// The running rest timer, at most one per user. Read by lambda/rest-push.
export const restTimerSk = () => "REST_TIMER";
// completedAt (an ISO timestamp) sits between the date and the random id so
// two sessions on the same date sort in the order they were finished.
export const sessionSk = (
  isoDate: string,
  completedAt: string,
  sessionId: string,
) => `SESSION#${isoDate}#${completedAt}#${sessionId}`;

// ---- Item shapes -------------------------------------------------------

export interface ProfileItem {
  displayName: string;
  units: "lb" | "kg";
  createdAt: string;
  // Unix ms; session tokens issued before this are rejected (lib/session.ts).
  sessionsValidAfter?: number;
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

export interface SettingsItem {
  barWeight: number;
  availablePlates: number[];
  restTimerSeconds: number;
}

/**
 * Used until a user has ever saved Settings (docs/todo.md §6). Kg-shaped
 * (20kg bar, standard Olympic kg plates) since that's this app's actual
 * user's unit -- a fresh profile also defaults to `units: "kg"`, see
 * app/settings/actions.ts and scripts/seed.ts.
 */
export const DEFAULT_SETTINGS: SettingsItem = {
  barWeight: 20,
  availablePlates: [20, 15, 10, 5, 2.5, 1.25],
  restTimerSeconds: 180,
};

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
  date: string; // ISO date, the lifter's local calendar date
  completedAt: string; // ISO timestamp, set by the server on save
  workoutType: "A" | "B";
  status: "completed" | "in_progress";
  sets: SessionSet[];
}

// ---- Access patterns -----------------------------------------------------

export async function putProfile(userId: string, profile: ProfileItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: profileSk(), ...profile },
    }),
  );
}

/**
 * Signs the user out everywhere. An update, not a put, so it never clobbers
 * the rest of the profile.
 */
export async function revokeSessions(userId: string, at: number) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: profileSk() },
      UpdateExpression: "SET sessionsValidAfter = :at",
      ExpressionAttributeValues: { ":at": at },
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

export async function putSettings(userId: string, settings: SettingsItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: settingsSk(), ...settings },
    }),
  );
}

export async function getSettings(userId: string) {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: settingsSk() },
    }),
  );
  return res.Item as (SettingsItem & { PK: string; SK: string }) | undefined;
}

export async function putSession(userId: string, session: SessionItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: userPk(userId),
        SK: sessionSk(session.date, session.completedAt, session.sessionId),
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
      ScanIndexForward: false, // newest first: SK embeds date, then completion time
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

// ---- Rest alerts (lambda/rest-push reads these too) ----------------------

export interface PushSubscriptionItem {
  endpoint: string;
  createdAt: string;
}

export async function putPushSubscription(
  userId: string,
  endpointHash: string,
  sub: PushSubscriptionItem,
) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: pushSubSk(endpointHash), ...sub },
    }),
  );
}

export async function deletePushSubscription(
  userId: string,
  endpointHash: string,
) {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: pushSubSk(endpointHash) },
    }),
  );
}

export async function hasPushSubscriptions(userId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":prefix": "PUSHSUB#",
      },
      Limit: 1,
    }),
  );
  return (res.Items ?? []).length > 0;
}

export interface RestTimerItem {
  timerId: string;
  /** Unix ms, by the server's clock. */
  endsAt: number;
}

export async function putRestTimer(userId: string, timer: RestTimerItem) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: userPk(userId), SK: restTimerSk(), ...timer },
    }),
  );
}

export async function deleteRestTimer(userId: string) {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: restTimerSk() },
    }),
  );
}
