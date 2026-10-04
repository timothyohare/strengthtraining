import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  isRevoked,
  verifySessionToken,
} from "../session";

const t = 1_790_000_000_000;

describe("createSessionToken", () => {
  it("records when the token was issued", () => {
    const payload = verifySessionToken(createSessionToken("tim", t));
    expect(payload?.issuedAt).toBe(t);
  });
});

describe("isRevoked", () => {
  it("never revokes when the user has never logged out", () => {
    expect(isRevoked({ userId: "tim", exp: 0, issuedAt: t }, undefined)).toBe(
      false,
    );
  });

  it("revokes a token issued before the cutoff", () => {
    expect(isRevoked({ userId: "tim", exp: 0, issuedAt: t - 1 }, t)).toBe(true);
  });

  it("keeps a token issued at or after the cutoff", () => {
    // The password change issues this device's new token at exactly `t`.
    expect(isRevoked({ userId: "tim", exp: 0, issuedAt: t }, t)).toBe(false);
    expect(isRevoked({ userId: "tim", exp: 0, issuedAt: t + 1 }, t)).toBe(false);
  });

  it("treats a token from before revocation existed as issued at 0", () => {
    expect(isRevoked({ userId: "tim", exp: 0 }, undefined)).toBe(false);
    expect(isRevoked({ userId: "tim", exp: 0 }, t)).toBe(true);
  });
});
