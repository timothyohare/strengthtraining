// @ts-check
/**
 * Rest-over push alert (infra/rest-push.yaml). Invoked asynchronously by the
 * app's scheduleRestAlert action with { userId, timerId } when a set is
 * logged. Waits until the rest ends, then sends a Web Push to every device
 * the user turned alerts on for. iOS pauses a backgrounded web app, so the
 * phone can't time this itself -- the server has to.
 *
 * The pushes carry no payload (Apple allows an empty body without
 * Content-Encoding), so there's no message encryption here, only the VAPID
 * signature. The service worker (public/sw.js) supplies the text.
 *
 * Dependency-free apart from the AWS SDK the Lambda runtime ships with, so
 * it deploys as this one file (infra/deploy-rest-push.sh).
 */
import { createPrivateKey, sign } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

/** Re-reads the timer this often, so a skip or a newer timer stops us quickly. */
export const POLL_MS = 5_000;
/** Started this long after the rest ended (e.g. a delayed async invoke)? Don't alert. */
const STALE_MS = 60_000;

/**
 * @typedef {{ publicKey: string, privateKey: string, subject: string }} Vapid
 *   publicKey: base64url uncompressed P-256 point (what the browser
 *   subscribed with); privateKey: base64url private scalar `d`.
 * @typedef {{ timerId: string, endsAt: number }} RestTimer
 * @typedef {{ endpoint: string, SK: string }} Subscription
 */

/**
 * @param {string} audience origin of the push service
 * @param {Vapid} vapid
 * @param {number} now unix ms
 */
export function vapidJwt(audience, vapid, now) {
  const point = Buffer.from(vapid.publicKey, "base64url");
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: point.subarray(1, 33).toString("base64url"),
      y: point.subarray(33, 65).toString("base64url"),
      d: vapid.privateKey,
    },
    format: "jwk",
  });
  const encode = (/** @type {object} */ obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({
    aud: audience,
    // Apple rejects an exp more than a day out.
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: vapid.subject,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

/**
 * @param {string} endpoint
 * @param {Vapid} vapid
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<number>} the push service's HTTP status
 */
export async function sendPush(endpoint, vapid, fetchImpl = fetch) {
  const jwt = vapidJwt(new URL(endpoint).origin, vapid, Date.now());
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      // A rest alert is worthless a minute late.
      TTL: "60",
      Urgency: "high",
      // Coalesces with any earlier undelivered rest alert.
      Topic: "rest-timer",
    },
  });
  return res.status;
}

/**
 * The timing loop, with its I/O injected so it can be tested without AWS.
 * @param {{
 *   timerId: string,
 *   deadline: number,
 *   now: () => number,
 *   sleep: (ms: number) => Promise<void>,
 *   getRest: () => Promise<RestTimer | undefined>,
 *   getSubs: () => Promise<Subscription[]>,
 *   send: (endpoint: string) => Promise<number>,
 *   removeSub: (sub: Subscription) => Promise<unknown>,
 *   clearRest: (timerId: string) => Promise<unknown>,
 * }} deps
 * @returns {Promise<"sent" | "cancelled" | "stale" | "timed-out">}
 */
export async function runRestTimer(deps) {
  for (;;) {
    const rest = await deps.getRest();
    // Skipped, finished, or replaced by a newer set's timer.
    if (!rest || rest.timerId !== deps.timerId) return "cancelled";

    const wait = rest.endsAt - deps.now();
    if (wait > 0) {
      const nap = Math.min(wait, POLL_MS);
      if (deps.now() + nap > deps.deadline) return "timed-out";
      await deps.sleep(nap);
      continue;
    }

    if (-wait > STALE_MS) {
      await deps.clearRest(deps.timerId);
      return "stale";
    }

    for (const sub of await deps.getSubs()) {
      try {
        const status = await deps.send(sub.endpoint);
        // The device unsubscribed or the subscription expired.
        if (status === 404 || status === 410) await deps.removeSub(sub);
        else if (status >= 400) console.warn("push rejected", status);
      } catch (err) {
        console.warn("push failed", err);
      }
    }
    await deps.clearRest(deps.timerId);
    return "sent";
  }
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * @param {{ userId: string, timerId: string }} event
 * @param {{ getRemainingTimeInMillis: () => number }} context
 */
export async function handler(event, context) {
  const table = process.env.DYNAMODB_TABLE;
  /** @type {Vapid} */
  const vapid = {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    subject: process.env.VAPID_SUBJECT ?? "",
  };
  const pk = `USER#${event.userId}`;

  const result = await runRestTimer({
    timerId: event.timerId,
    deadline: Date.now() + context.getRemainingTimeInMillis() - 10_000,
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    getRest: async () =>
      /** @type {RestTimer | undefined} */ (
        (await ddb.send(new GetCommand({ TableName: table, Key: { PK: pk, SK: "REST_TIMER" } })))
          .Item
      ),
    getSubs: async () =>
      /** @type {Subscription[]} */ (
        (
          await ddb.send(
            new QueryCommand({
              TableName: table,
              KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
              ExpressionAttributeValues: { ":pk": pk, ":prefix": "PUSHSUB#" },
            }),
          )
        ).Items ?? []
      ),
    send: (endpoint) => sendPush(endpoint, vapid),
    removeSub: (sub) =>
      ddb.send(
        new DeleteCommand({
          TableName: table,
          Key: { PK: pk, SK: sub.SK },
        }),
      ),
    // Only clears our own timer -- a newer one may have replaced it meanwhile.
    clearRest: (timerId) =>
      ddb
        .send(
          new DeleteCommand({
            TableName: table,
            Key: { PK: pk, SK: "REST_TIMER" },
            ConditionExpression: "timerId = :id",
            ExpressionAttributeValues: { ":id": timerId },
          }),
        )
        .catch(() => {}),
  });
  console.log(JSON.stringify({ userId: event.userId, timerId: event.timerId, result }));
  return result;
}
