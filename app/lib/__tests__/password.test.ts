import { describe, expect, it } from "vitest";
import { validatePasswordChange } from "../password";

const current = "OldPassword123";
const strong = "NewPassword456";

describe("validatePasswordChange", () => {
  it("accepts a strong new password that's confirmed", () => {
    expect(validatePasswordChange(current, strong, strong)).toBeNull();
  });

  it("requires the current password", () => {
    expect(validatePasswordChange("", strong, strong)).toMatch(/current/);
  });

  it("rejects a confirmation that doesn't match", () => {
    expect(validatePasswordChange(current, strong, `${strong}x`)).toMatch(
      /match/,
    );
  });

  it("rejects reusing the current password", () => {
    expect(validatePasswordChange(current, current, current)).toMatch(
      /different/,
    );
  });

  it.each([
    ["shorter than 12 characters", "Short12Abcd"],
    ["missing an uppercase letter", "newpassword456"],
    ["missing a lowercase letter", "NEWPASSWORD456"],
    ["missing a number", "NewPasswordAbc"],
  ])("rejects a password %s", (_, weak) => {
    expect(validatePasswordChange(current, weak, weak)).toMatch(/too weak/);
  });

  it("accepts exactly 12 characters", () => {
    const twelve = "Abcdefghij12";
    expect(twelve).toHaveLength(12);
    expect(validatePasswordChange(current, twelve, twelve)).toBeNull();
  });
});
