import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/db/schema";
import {
  isRevoked,
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

/**
 * The full session check: a valid signature (lib/session.ts) *and* not
 * revoked by a later logout or password change. Every protected page,
 * action and proxy.ts go through this rather than verifySessionToken alone,
 * which can't see revocation.
 */
export async function getSession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const profile = await getProfile(payload.userId);
  return isRevoked(payload, profile?.sessionsValidAfter) ? null : payload;
}

/** For pages and server actions: the session, or a redirect to /login. */
export async function requireSession(): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE.name)?.value);
  if (!session) redirect("/login");
  return session;
}
