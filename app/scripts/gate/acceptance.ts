/**
 * gate-verify `acceptance`: auth and data-isolation claims from
 * docs/verification-plan.md §2, checked against the booted app. Every check
 * runs; the script exits 1 if any failed. Run by the gate, not by hand.
 *
 * Session cookies are minted with the gate's SESSION_SECRET instead of
 * logging in, so these checks don't need Cognito.
 */
import { createHmac } from "node:crypto";
import { createSessionToken, SESSION_COOKIE } from "../../lib/session";
import { assertLocalGateDb } from "./guard";
import { GATE_USERS } from "./fixtures";

assertLocalGateDb();

const BASE = process.env.GATE_BASE_URL ?? "http://localhost:3100";
const a = GATE_USERS.a;
const b = GATE_USERS.b;

function get(path: string, token?: string) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: token ? { cookie: `${SESSION_COOKIE.name}=${token}` } : {},
  });
}

function logout(token: string) {
  return fetch(`${BASE}/api/logout`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: `${SESSION_COOKIE.name}=${token}` },
  });
}

function sign(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function isLoginRedirect(res: Response) {
  const location = res.headers.get("location") ?? "";
  return res.status >= 300 && res.status < 400 && /\/login$/.test(location);
}

const checks: [string, () => Promise<string | null>][] = [
  [
    "no cookie → protected pages redirect to /login",
    async () => {
      for (const path of ["/today", "/history", "/settings", "/settings/password"]) {
        const res = await get(path);
        if (!isLoginRedirect(res)) return `${path} answered ${res.status}`;
      }
      return null;
    },
  ],
  [
    "cookie signed with the wrong secret is rejected",
    async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const res = await get("/today", sign({ userId: a.userId, exp }, "not-the-secret"));
      return isLoginRedirect(res) ? null : `answered ${res.status}`;
    },
  ],
  [
    "cookie with a swapped userId but the original signature is rejected",
    async () => {
      const [, sig] = createSessionToken(a.userId).split(".");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const forgedBody = Buffer.from(JSON.stringify({ userId: b.userId, exp })).toString("base64url");
      const res = await get("/today", `${forgedBody}.${sig}`);
      return isLoginRedirect(res) ? null : `answered ${res.status}`;
    },
  ],
  [
    "expired cookie is rejected",
    async () => {
      const secret = process.env.SESSION_SECRET ?? "";
      const exp = Math.floor(Date.now() / 1000) - 60;
      const res = await get("/today", sign({ userId: a.userId, exp }, secret));
      return isLoginRedirect(res) ? null : `answered ${res.status}`;
    },
  ],
  [
    "each user sees only their own data",
    async () => {
      for (const [me, other] of [[a, b], [b, a]] as const) {
        const token = createSessionToken(me.userId);
        for (const path of ["/settings", "/today"]) {
          const res = await get(path, token);
          if (res.status !== 200) return `${me.userId} ${path} answered ${res.status}`;
          const html = await res.text();
          if (!html.includes(String(me.squat))) {
            return `${me.userId} ${path} is missing their own Squat weight ${me.squat}`;
          }
          if (html.includes(String(other.squat))) {
            return `${me.userId} ${path} shows ${other.userId}'s Squat weight ${other.squat}`;
          }
        }
      }
      return null;
    },
  ],
  [
    "logout clears the session cookie",
    async () => {
      const res = await fetch(`${BASE}/api/logout`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie: `${SESSION_COOKIE.name}=${createSessionToken(a.userId)}` },
      });
      if (!isLoginRedirect(res)) return `answered ${res.status}`;
      const setCookie = res.headers.get("set-cookie") ?? "";
      const cleared =
        setCookie.startsWith(`${SESSION_COOKIE.name}=;`) &&
        /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie);
      return cleared ? null : `Set-Cookie was "${setCookie}"`;
    },
  ],
  [
    "a cookie used before logout is rejected afterwards",
    async () => {
      const token = createSessionToken(a.userId);
      await logout(token);
      const res = await get("/today", token);
      return isLoginRedirect(res)
        ? null
        : `replayed cookie still works (answered ${res.status})`;
    },
  ],
  [
    "logging out signs out the user's other devices, but not other users",
    async () => {
      const phone = createSessionToken(a.userId);
      const laptop = createSessionToken(a.userId);
      const otherUser = createSessionToken(b.userId);
      await logout(phone);
      const laptopRes = await get("/today", laptop);
      if (!isLoginRedirect(laptopRes)) {
        return `${a.userId}'s other device still works (answered ${laptopRes.status})`;
      }
      const otherRes = await get("/today", otherUser);
      return otherRes.status === 200
        ? null
        : `${b.userId} was signed out too (answered ${otherRes.status})`;
    },
  ],
  [
    "a session issued after logout works",
    async () => {
      await logout(createSessionToken(a.userId));
      await new Promise((r) => setTimeout(r, 5));
      const res = await get("/settings", createSessionToken(a.userId));
      return res.status === 200 ? null : `answered ${res.status}`;
    },
  ],
];

async function main() {
  let failed = 0;
  for (const [name, run] of checks) {
    let problem: string | null;
    try {
      problem = await run();
    } catch (err) {
      problem = `threw ${err instanceof Error ? err.message : String(err)}`;
    }
    if (problem) failed++;
    console.log(`${problem ? "✗" : "✓"} ${name}${problem ? ` — ${problem}` : ""}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} acceptance checks passed`);
  process.exit(failed ? 1 : 0);
}

main();
