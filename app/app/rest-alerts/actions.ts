"use server";

import { createHash, randomUUID } from "node:crypto";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import {
  deletePushSubscription,
  deleteRestTimer,
  hasPushSubscriptions,
  putPushSubscription,
  putRestTimer,
} from "@/lib/db/schema";
import { isPushEndpoint } from "@/lib/push-endpoint";

/**
 * Rest-over push alerts (lambda/rest-push, infra/rest-push.yaml). The
 * workout screen calls scheduleRestAlert each time a rest starts; the Lambda
 * waits out the rest and pushes to every device with alerts turned on.
 *
 * REST_PUSH_FUNCTION unset (local dev, gate-verify) means alerts are off:
 * subscriptions still save, but nothing is scheduled.
 *
 * None of these revalidate anything -- see setLiftWeight in
 * app/today/actions.ts for why that matters on /today.
 */

const FUNCTION_NAME = process.env.REST_PUSH_FUNCTION;
const lambda = new LambdaClient({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
});

async function requireUserId() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE.name)?.value);
  if (!session) throw new Error("Not authenticated");
  return session.userId;
}

function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export async function savePushSubscription(endpoint: string) {
  const userId = await requireUserId();
  if (!isPushEndpoint(endpoint)) throw new Error("Not a push endpoint");
  await putPushSubscription(userId, endpointHash(endpoint), {
    endpoint,
    createdAt: new Date().toISOString(),
  });
}

export async function removePushSubscription(endpoint: string) {
  const userId = await requireUserId();
  await deletePushSubscription(userId, endpointHash(endpoint));
}

/** Longest rest the Lambda can wait out (its 15-minute limit, less margin). */
const MAX_REST_SECONDS = 840;

/**
 * Starts (or restarts, e.g. after +30s) the rest alert. A new timerId each
 * time: any Lambda still waiting on an older timer sees it was replaced and
 * stops. Returns whether an alert was actually scheduled.
 */
export async function scheduleRestAlert(seconds: number): Promise<boolean> {
  const userId = await requireUserId();
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_REST_SECONDS) {
    throw new Error("Invalid rest length");
  }
  if (!FUNCTION_NAME || !(await hasPushSubscriptions(userId))) return false;

  const timerId = randomUUID();
  await putRestTimer(userId, { timerId, endsAt: Date.now() + seconds * 1000 });
  await lambda.send(
    new InvokeCommand({
      FunctionName: FUNCTION_NAME,
      InvocationType: "Event",
      Payload: JSON.stringify({ userId, timerId }),
    }),
  );
  return true;
}

/** Skip, or the workout finished: the waiting Lambda sees no timer and stops. */
export async function cancelRestAlert() {
  const userId = await requireUserId();
  if (!FUNCTION_NAME) return;
  await deleteRestTimer(userId);
}

/** Settings' "Send a test": a short rest, so it arrives in a few seconds. */
export async function sendTestRestAlert() {
  return scheduleRestAlert(5);
}
