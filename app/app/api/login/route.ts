import { verifyCognitoCredentials } from "@/lib/cognito";
import { redirectTo } from "@/lib/redirect";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return redirectTo("/login?error=1", 303);
  }

  const result = await verifyCognitoCredentials(username, password);
  if (!result.ok) {
    return redirectTo("/login?error=1", 303);
  }

  const token = createSessionToken(username);
  const response = redirectTo("/today", 303);
  response.cookies.set(SESSION_COOKIE.name, token, sessionCookieOptions());
  return response;
}
