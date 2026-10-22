import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "../with-timeout";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    const result = withTimeout(Promise.resolve(42), 1000);
    await expect(result).resolves.toBe(42);
  });

  it("passes through the promise's own rejection", async () => {
    const result = withTimeout(Promise.reject(new Error("boom")), 1000);
    await expect(result).rejects.toThrow("boom");
  });

  it("rejects with TimeoutError when the promise never settles", async () => {
    const result = withTimeout(new Promise(() => {}), 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("does not time out a moment before the limit", async () => {
    let settled = false;
    withTimeout(new Promise(() => {}), 1000).catch(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it("names the limit in the error", async () => {
    const result = withTimeout(new Promise(() => {}), 250);
    const assertion = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Timed out after 250 ms",
    });
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
  });

  it("clears its timer once the promise settles", async () => {
    await withTimeout(Promise.resolve("ok"), 1000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
