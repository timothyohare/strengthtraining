import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
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

export async function verifyCognitoCredentials(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false }> {
  const client = new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION ?? "ap-southeast-2",
  });

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

    return result.AuthenticationResult ? { ok: true } : { ok: false };
  } catch (err) {
    if (
      err instanceof NotAuthorizedException ||
      err instanceof UserNotFoundException
    ) {
      return { ok: false };
    }
    throw err;
  }
}
