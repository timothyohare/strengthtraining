"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { changeCognitoPassword } from "@/lib/cognito";
import { PASSWORD_RULES, validatePasswordChange } from "@/lib/password";

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const FAILURE_MESSAGES = {
  "wrong-current": "Your current password isn’t right. Try again.",
  rejected: `Cognito didn’t accept that new password. ${PASSWORD_RULES}`,
  "rate-limited":
    "Too many attempts. Wait a few minutes before trying again.",
} as const;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );
  if (!session) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const invalid = validatePasswordChange(
    currentPassword,
    newPassword,
    confirmPassword,
  );
  if (invalid) return { status: "error", message: invalid };

  // Always the signed-in user's own account -- never a username from the form.
  const result = await changeCognitoPassword(
    session.userId,
    currentPassword,
    newPassword,
  );
  if (!result.ok) {
    return { status: "error", message: FAILURE_MESSAGES[result.reason] };
  }
  return { status: "success" };
}
