import { NextResponse } from "next/server";
import { verifyCognitoCredentials } from "@/lib/cognito";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const result = await verifyCognitoCredentials(username, password);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const token = createSessionToken(username);
  const response = NextResponse.redirect(new URL("/today", request.url), 303);
  response.cookies.set(SESSION_COOKIE.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE.maxAge,
    path: "/",
  });
  return response;
}
