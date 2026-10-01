import { describe, expect, it } from "vitest";
import { sessionSk } from "../db/schema";

describe("sessionSk", () => {
  it("embeds date, completion time and id", () => {
    expect(sessionSk("2026-10-01", "2026-10-01T07:00:00.000Z", "abc")).toBe(
      "SESSION#2026-10-01#2026-10-01T07:00:00.000Z#abc",
    );
  });

  it("orders by date first, then by completion time on the same date", () => {
    const keys = [
      sessionSk("2026-10-02", "2026-10-01T22:00:00.000Z", "zzz"),
      sessionSk("2026-10-01", "2026-10-01T09:00:00.000Z", "fff"),
      sessionSk("2026-10-01", "2026-10-01T07:00:00.000Z", "999"),
    ];
    expect([...keys].sort()).toEqual([keys[2], keys[1], keys[0]]);
  });

  it("ignores the random session id when ordering", () => {
    const earlier = sessionSk("2026-10-01", "2026-10-01T07:00:00.000Z", "ffff");
    const later = sessionSk("2026-10-01", "2026-10-01T08:00:00.000Z", "0000");
    expect(earlier < later).toBe(true);
  });
});
