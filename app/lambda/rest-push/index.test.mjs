import { describe, expect, it, vi } from "vitest";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { runRestTimer, sendPush, vapidJwt } from "./index.mjs";

function makeVapid() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, "base64url"),
    Buffer.from(jwk.y, "base64url"),
  ]);
  return {
    publicKey: raw.toString("base64url"),
    privateKey: jwk.d,
    subject: "https://strength.example",
    jwk,
  };
}

describe("vapidJwt", () => {
  it("is an ES256 JWT that the public key verifies, with Apple's required claims", () => {
    const vapid = makeVapid();
    const now = 1_700_000_000_000;
    const jwt = vapidJwt("https://web.push.apple.com", vapid, now);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.sub).toBe("https://strength.example");
    // Apple rejects exp more than a day out.
    expect(claims.exp - now / 1000).toBeGreaterThan(0);
    expect(claims.exp - now / 1000).toBeLessThanOrEqual(24 * 3600);
    const publicJwk = { kty: "EC", crv: "P-256", x: vapid.jwk.x, y: vapid.jwk.y };
    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${c}`),
      { key: createPublicKey({ key: publicJwk, format: "jwk" }), dsaEncoding: "ieee-p1363" },
      Buffer.from(s, "base64url"),
    );
    expect(ok).toBe(true);
  });
});

describe("sendPush", () => {
  it("POSTs an empty push with VAPID auth for the endpoint's origin", async () => {
    const vapid = makeVapid();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const status = await sendPush("https://web.push.apple.com/abc123", vapid, fetchImpl);
    expect(status).toBe(201);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://web.push.apple.com/abc123");
    expect(init.method).toBe("POST");
    expect(init.headers.TTL).toBe("60");
    expect(init.headers.Urgency).toBe("high");
    expect(init.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.publicKey}$`),
    );
    const claims = JSON.parse(
      Buffer.from(init.headers.Authorization.split(".")[1], "base64url").toString(),
    );
    expect(claims.aud).toBe("https://web.push.apple.com");
  });
});

function fakeTimer({ rests, subs = [{ endpoint: "https://push/1" }], statuses = {} }) {
  let t = 0;
  const calls = { sent: [], removed: [], cleared: [], slept: [] };
  let i = 0;
  const deps = {
    timerId: "t1",
    deadline: 900_000,
    now: () => t,
    sleep: async (ms) => {
      calls.slept.push(ms);
      t += ms;
    },
    getRest: async () => {
      const r = typeof rests === "function" ? rests(t) : rests[Math.min(i, rests.length - 1)];
      i++;
      return r;
    },
    getSubs: async () => subs,
    send: async (endpoint) => {
      calls.sent.push({ endpoint, at: t });
      return statuses[endpoint] ?? 201;
    },
    removeSub: async (sub) => calls.removed.push(sub.endpoint),
    clearRest: async (id) => calls.cleared.push(id),
  };
  return { deps, calls };
}

describe("runRestTimer", () => {
  it("waits until the rest ends, then pushes to every subscription and clears the timer", async () => {
    const { deps, calls } = fakeTimer({
      rests: () => ({ timerId: "t1", endsAt: 12_000 }),
      subs: [{ endpoint: "https://push/1" }, { endpoint: "https://push/2" }],
    });
    expect(await runRestTimer(deps)).toBe("sent");
    expect(calls.sent).toEqual([
      { endpoint: "https://push/1", at: 12_000 },
      { endpoint: "https://push/2", at: 12_000 },
    ]);
    expect(calls.cleared).toEqual(["t1"]);
  });

  it("polls rather than sleeping the whole rest, so a skip stops it early", async () => {
    const { deps, calls } = fakeTimer({
      rests: (t) => (t < 10_000 ? { timerId: "t1", endsAt: 180_000 } : undefined),
    });
    expect(await runRestTimer(deps)).toBe("cancelled");
    expect(calls.sent).toEqual([]);
    expect(Math.max(...calls.slept)).toBeLessThanOrEqual(5_000);
  });

  it("stands down when a newer timer replaced it", async () => {
    const { deps, calls } = fakeTimer({ rests: [{ timerId: "t2", endsAt: 5_000 }] });
    expect(await runRestTimer(deps)).toBe("cancelled");
    expect(calls.sent).toEqual([]);
    expect(calls.cleared).toEqual([]);
  });

  it("follows the end time when the rest is extended (+30s)", async () => {
    const { deps, calls } = fakeTimer({
      rests: (t) => ({ timerId: "t1", endsAt: t < 4_000 ? 6_000 : 36_000 }),
    });
    expect(await runRestTimer(deps)).toBe("sent");
    expect(calls.sent[0].at).toBe(36_000);
  });

  it("removes subscriptions the push service says are gone", async () => {
    const { deps, calls } = fakeTimer({
      rests: () => ({ timerId: "t1", endsAt: 0 }),
      subs: [{ endpoint: "https://push/gone" }, { endpoint: "https://push/ok" }],
      statuses: { "https://push/gone": 410 },
    });
    await runRestTimer(deps);
    expect(calls.removed).toEqual(["https://push/gone"]);
  });

  it("doesn't send a stale alert if it started long after the rest ended", async () => {
    const { deps, calls } = fakeTimer({ rests: () => ({ timerId: "t1", endsAt: -120_000 }) });
    expect(await runRestTimer(deps)).toBe("stale");
    expect(calls.sent).toEqual([]);
    expect(calls.cleared).toEqual(["t1"]);
  });

  it("gives up before the Lambda's own deadline", async () => {
    const { deps, calls } = fakeTimer({ rests: () => ({ timerId: "t1", endsAt: 2_000_000 }) });
    expect(await runRestTimer(deps)).toBe("timed-out");
    expect(calls.sent).toEqual([]);
  });

  it("keeps going if one push fails outright", async () => {
    const { deps, calls } = fakeTimer({
      rests: () => ({ timerId: "t1", endsAt: 0 }),
      subs: [{ endpoint: "https://push/bad" }, { endpoint: "https://push/ok" }],
    });
    const send = deps.send;
    deps.send = async (endpoint) => {
      if (endpoint === "https://push/bad") throw new Error("network");
      return send(endpoint);
    };
    expect(await runRestTimer(deps)).toBe("sent");
    expect(calls.sent.map((s) => s.endpoint)).toEqual(["https://push/ok"]);
  });
});
