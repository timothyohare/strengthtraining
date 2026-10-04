import { createHmac } from "node:crypto";
import {
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InvalidParameterException,
  InvalidPasswordException,
  LimitExceededException,
  NotAuthorizedException,
  PasswordHistoryPolicyViolationException,
  TooManyRequestsException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Real Cognito credential check, replacing the stand-in password comparison
 * from Spike 3 (docs/spikes.md). Uses the USER_PASSWORD_AUTH flow directly
 * against Cognito's public (unauthenticated) InitiateAuth API -- this needs
 * no IAM credentials at runtime, only the app client id/secret, so neither
 * local dev nor the deployed app needs an AWS IAM role just to log in.
 *
 * Architecture note: this function only verifies the credential. The caller
 * (app/api/login/route.ts) still issues the app's own signed cookie via
 * lib/session.ts on success -- exactly the "login-route change, not an
 * architecture change" swap the spike anticipated. Proxy.ts and every
 * protected page are unaffected by this file.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set (see .env.local / human-todo.md)`);
  }
  return value;
}

function computeSecretHash(username: string): string {
  const clientId = requireEnv("COGNITO_CLIENT_ID");
  const clientSecret = requireEnv("COGNITO_CLIENT_SECRET");
  return createHmac("sha256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

function cognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION ?? "ap-southeast-2",
  });
}

/** Returns the user's access token, or null if the credential is wrong. */
async function authenticate(
  client: CognitoIdentityProviderClient,
  username: string,
  password: string,
): Promise<string | null> {
  try {
    const result = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: requireEnv("COGNITO_CLIENT_ID"),
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: computeSecretHash(username),
        },
      }),
    );

    return result.AuthenticationResult?.AccessToken ?? null;
  } catch (err) {
    if (
      err instanceof NotAuthorizedException ||
      err instanceof UserNotFoundException
    ) {
      return null;
    }
    throw err;
  }
}

export async function verifyCognitoCredentials(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false }> {
  const accessToken = await authenticate(cognitoClient(), username, password);
  return accessToken ? { ok: true } : { ok: false };
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong-current" | "rejected" | "rate-limited" };

/**
 * Cognito's ChangePassword needs the user's access token, but the app only
 * keeps its own session cookie (see the note above). So this signs in again
 * with the current password to get a short-lived token, then uses it right
 * away -- which also proves the current password before anything changes.
 */
export async function changeCognitoPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const client = cognitoClient();

  try {
    const accessToken = await authenticate(client, username, currentPassword);
    if (!accessToken) return { ok: false, reason: "wrong-current" };

    await client.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      }),
    );
    return { ok: true };
  } catch (err) {
    if (
      err instanceof InvalidPasswordException ||
      err instanceof InvalidParameterException ||
      err instanceof PasswordHistoryPolicyViolationException
    ) {
      return { ok: false, reason: "rejected" };
    }
    if (
      err instanceof LimitExceededException ||
      err instanceof TooManyRequestsException
    ) {
      return { ok: false, reason: "rate-limited" };
    }
    throw err;
  }
}
