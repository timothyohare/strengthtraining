import { describe, expect, it } from "vitest";
import { isIsoDate, localIsoDate } from "../dates";

describe("localIsoDate", () => {
  it("uses the device's local calendar date, not UTC", () => {
    // 8:30am local on 1 Oct. In Australia that instant is still 30 Sep in
    // UTC, which is the bug toISOString().slice(0, 10) had.
    expect(localIsoDate(new Date(2026, 9, 1, 8, 30))).toBe("2026-10-01");
  });

  it("zero-pads month and day", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD only", () => {
    expect(isIsoDate("2026-10-01")).toBe(true);
    expect(isIsoDate("2026-10-01T00:00:00Z")).toBe(false);
    expect(isIsoDate("01/10/2026")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
  });
});
