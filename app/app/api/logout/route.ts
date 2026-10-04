import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { revokeSessions } from "@/lib/db/schema";
import { redirectTo } from "@/lib/redirect";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  // Deleting the cookie only clears this browser; revoking makes any copy of
  // the token (and every other device's) stop working too.
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE.name)?.value);
  if (session) await revokeSessions(session.userId, Date.now());

  const response = redirectTo("/login", 303);
  response.cookies.delete(SESSION_COOKIE.name);
  return response;
}
