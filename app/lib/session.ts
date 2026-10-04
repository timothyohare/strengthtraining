import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stand-in session implementation for Spike 3 (docs/spikes.md). Proves out the
 * "log in once, long-lived httpOnly cookie, server-validated on every request"
 * architecture from prd.md §6 without needing a real Cognito pool (which needs
 * an AWS account -- see human-todo.md). Swapping this for real Cognito later
 * is a login-route change, not an architecture change: the cookie shape,
 * proxy.ts guard, and this verify function stay the same.
 */

export const SESSION_COOKIE = {
  name: "session",
  maxAge: 60 * 60 * 24 * 90, // 90 days, per prd.md §6
};

export interface SessionPayload {
  userId: string;
  exp: number; // unix seconds
  // Unix ms. Absent on tokens issued before logout revocation existed.
  issuedAt?: number;
}

/** Cookie attributes for a freshly issued session, shared by every issuer. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_COOKIE.maxAge,
    path: "/",
  };
}

/**
 * Logging out or changing the password stamps the user's profile with
 * `sessionsValidAfter`; any token issued before that is dead, on every
 * device. A token with no `issuedAt` predates revocation and counts as
 * issued at 0, so it survives only until the user's first logout.
 */
export function isRevoked(
  payload: SessionPayload,
  sessionsValidAfter: number | undefined,
): boolean {
  if (sessionsValidAfter === undefined) return false;
  return (payload.issuedAt ?? 0) < sessionsValidAfter;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-insecure-secret-do-not-use-in-production";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function createSessionToken(
  userId: string,
  now: number = Date.now(),
): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(now / 1000) + SESSION_COOKIE.maxAge,
    issuedAt: now,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${base64url(signature)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) return null;

  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
