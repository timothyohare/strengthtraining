/**
 * Mirrors the Cognito user pool's PasswordPolicy (infra/cognito.yaml) so the
 * Change password screen can say exactly what's wrong before a round trip.
 * Cognito still enforces the real policy; keep these two in step.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_RULES = `At least ${MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`;

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword) return "Enter your current password.";
  if (newPassword !== confirmPassword) {
    return "The new passwords don’t match.";
  }
  if (newPassword === currentPassword) {
    return "The new password must be different from your current one.";
  }
  if (
    newPassword.length < MIN_PASSWORD_LENGTH ||
    !/[A-Z]/.test(newPassword) ||
    !/[a-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    return `The new password is too weak. ${PASSWORD_RULES}`;
  }
  return null;
}
