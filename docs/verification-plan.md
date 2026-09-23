# Verification Plan

Goal: every claim in `prd.md` ("it does X", "it costs near $0") is backed by a check that
fails loudly when the claim is false — not just "I looked at it and it seemed fine."

## 1. Program engine correctness (unit tests)

The progression/deload/warm-up/plate logic in `todo.md` §4 is pure logic and should be the
most heavily tested part of the app — it's the whole point of the product.

| Claim | Test |
|---|---|
| App alternates Workout A/B correctly | Given a sequence of completed sessions, assert the next-workout function returns the correct type at every step, including the very first session (no history) |
| Weight increases only on a fully completed lift | Table-test: all sets/reps hit → weight increases by configured increment; any set missed → weight stays the same |
| Deload triggers after 3 consecutive failed sessions on a lift | Simulate 3 consecutive fails → assert 10% reduction applied on the 4th session's target weight; simulate 2 fails + 1 success → assert no deload (streak resets) |
| Double-deload drops a lift to 3x5 | Simulate two separate deload events on the same lift → assert the lift's set count changes from 5 to 3 and stays at 3 thereafter |
| Warm-up calculator produces a sane ramp | Given a range of work weights (e.g., 45–405 lb) and a fixed bar weight, assert output sets are non-decreasing, start at bar weight, and end at (or just below) the work weight |
| Plate calculator is correct and handles "unachievable" weights | Given target weight, bar weight, and a plate set, assert returned plates-per-side sum to the correct total; given an odd target not exactly loadable with available plates, assert it returns the closest achievable weight rather than crashing or silently lying |

Run: `npm test` (or project's chosen test runner) as part of CI before every deploy. This
is the concrete gate — "the program logic is correct" is only true when this suite is green.

## 2. Auth & session behavior

| Claim | Test |
|---|---|
| Login once, stay logged in | Automated: log in, capture cookie, wait/simulate time passage within the 90-day window, confirm a protected route still succeeds without re-auth. Manual: log in on a real phone, close the browser, reopen the app 2+ days later, confirm still logged in |
| Session cookie is secure | Inspect Set-Cookie header in a real request: confirm `HttpOnly`, `Secure`, `SameSite=Lax` (or stricter) are all present |
| Logout actually invalidates the session | Log out, then replay the old cookie value against a protected route — must be rejected, not just client-side redirect |
| One user cannot see another user's data | With two seeded users, attempt to fetch user B's session/lift data using user A's authenticated session — must be rejected/empty, not just hidden in the UI |

## 3. End-to-end / boot-and-verify

Mirrors the "boot-and-verify" gate philosophy from the CLAUDE.md SDLC harness, adapted for
this project even before a formal `harness.json` binding exists:

- [ ] Boot the app against a real (or DynamoDB Local) table and Cognito pool
- [ ] Scripted flow: sign in → land on today's workout → mark all sets done for one lift →
      confirm next session shows the incremented weight for that lift
- [ ] Scripted flow: sign in → fail all sets on a lift 3 sessions in a row → confirm 4th
      session shows the 10% deload
- [ ] Manual, on a real phone over cellular (not just Wi-Fi/desktop): full workout flow,
      including rest timer alert and plate calculator display, checking for layout/tap-target
      issues at actual gym-use conditions (one-handed, screen brightness, etc.)

## 4. Cost verification

This is the claim most likely to quietly become false without anyone noticing, so it gets an
explicit recurring check rather than a one-time "looks right."

- [ ] After deploy, confirm in the AWS console that the DynamoDB table is on on-demand
      billing (not provisioned capacity) — this is the actual thing that keeps idle cost at $0
- [ ] After one full idle week, check AWS Cost Explorer: total spend should be under $1;
      anything higher means a config assumption in the PRD's cost model was wrong and needs
      re-examining
- [ ] Confirm the AWS Budget alert (set up in `human-todo.md`) actually fires a test
      notification — an alert that silently fails to fire is worse than no alert

## 5. Cold app-open latency check

- [ ] After a period of no traffic (Lambda/Amplify compute cold start, not a DynamoDB
      concern — DynamoDB itself has no cold-start ramp-up), time "open app → see today's
      workout" and confirm it's acceptable UX. If it's consistently bad, that's a Lambda/SSR
      cold-start problem to address directly (e.g. provisioned concurrency), not a database one.

## 6. Definition of done for v1

All of the following must be true, not just claimed:

- [ ] Unit test suite (§1) green
- [ ] Auth/session checks (§2) pass, including the cross-user data isolation check
- [ ] Both scripted E2E flows in §3 pass against a real deployed environment
- [ ] One full idle week's AWS bill is under $1, verified in Cost Explorer (§4)
- [ ] Cold app-open latency measured and judged acceptable, or a mitigation decision made (§5)
- [ ] The app has been used for at least one real 3-day training week by the primary user, end
      to end, without falling back to manual tracking
