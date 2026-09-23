# TODO — Engineering (agent/dev-executable)

Tasks a coding agent or the developer can do without any human-only account/billing action.
Ordered roughly by dependency. Check items off as completed. See `human-todo.md` for the
account-setup steps these depend on, and `verification-plan.md` for how each milestone is proven done.

## 0. Project scaffolding

- [x] `git init` the repo at the top level (`docs/`, `spikes/`, `app/` all in one repo), root `.gitignore` added, initial commit made and pushed to `https://github.com/timothyohare/strengthtraining` (public)
- [x] Scaffold Next.js app (App Router, TypeScript, Tailwind) — `app/`, see `docs/scaffold-plan.md`
- [x] Set up PWA manifest + service worker for home-screen install and basic asset caching — `app/public/manifest.json`, `app/public/sw.js`
- [x] Add `harness.json` / lint + typecheck + build scripts — `.claude/harness.json` at repo root, `pnpm typecheck` added to `app/package.json`; `gate-ci --full` verified green

## 1. Backend infra

**Correction from the original plan:** neither of the two sibling projects used as reference
(nrl-predictor, rotrade — see `docs/spikes.md` Spike 3 update) actually uses Amplify Gen 2's
`amplify/` TypeScript backend framework. Both use Amplify Hosting purely as zero-config git-
connected frontend hosting, with backend AWS resources (Cognito, DynamoDB) provisioned by
plain CloudFormation or CDK instead. This repo follows that pattern:

- [x] Cognito User Pool + App Client provisioned via `infra/cognito.yaml` (CloudFormation),
  no self-service sign-up, `USER_PASSWORD_AUTH` flow, region `ap-southeast-2` (same account/
  region nrl-predictor already runs in — account `810429055117`)
- [x] DynamoDB table provisioned via `infra/dynamodb.yaml` (separate stack, `lift5-dynamodb`,
  on-demand billing confirmed via `aws dynamodb describe-table`) — table `lift5-dev`
- [x] Wired `@aws-sdk/lib-dynamodb` access from the Next.js server — `app/lib/db/schema.ts`,
  ported directly from the spike, zero logic changes
- [ ] Production (Amplify Hosting) will need its own IAM permissions for this table on the
  app's compute role — local dev works via ambient AWS CLI credentials, which won't exist on
  the deployed app; not yet configured
- [ ] **Do not add `amplify.yml`** when connecting the repo to Amplify Hosting — see
  `app/CLAUDE.md`'s "Amplify deploy lessons" for why (breaks the Next.js SSR adapter's
  auto-detection, confirmed root cause of a real nrl-predictor outage)
- [ ] Configure environment separation (dev vs prod) if desired, or single environment for a
  personal-scale project (decide and document the choice) — `infra/cognito.yaml` already
  takes a `StageName` parameter for this

## 2. Data model

Single DynamoDB table, design and every access pattern already validated live in
`spikes/dynamodb-schema/` (see `docs/spikes.md` for the spike write-up) — ported into the
real app, and now backed by a real deployed table:

- [x] Ported `spikes/dynamodb-schema/src/schema.ts` into `app/lib/db/schema.ts` (table def,
  key helpers, item types, access-pattern functions)
- [x] `PROFILE` item — per user (display name, unit preference, created_at)
- [x] `LIFT#<name>` items — per-user configured lifts (current working weight, increment,
  roundTo, set count, fail streak, deload count)
- [x] `SESSION#<date>#<id>` items — item shape ported and typed (`SessionItem`), not yet
  written by any real flow (set-logging UI is §5, still pending)
- [ ] `bodyweight_logs` (stretch) — decide item shape when this is picked up (not spiked yet)
- [x] Seed script — `app/scripts/seed.ts` (`pnpm exec tsx scripts/seed.ts <userId>`), seeded
  the default StrongLifts A/B program for user `tim` in the real table
- [ ] **Known gap:** the deload → 3x5 fallback rule in
  `lib/program-engine/progression.ts` was validated (spike) for the 5-set lifts; Deadlift's
  classic 1-set program design isn't correctly modeled by the same generic rule if it ever
  deloads twice (would incorrectly bump it to 3 sets). Not yet hit in practice since no real
  sessions have been logged; fix before deload logic runs against Deadlift for real.

## 3. Auth & session

The cookie/session architecture is built and smoke-tested (Spike 3, `docs/spikes.md`), and the
stand-in password check has been swapped for real Cognito:

- [x] Real Cognito login flow wired into Next.js — `lib/cognito.ts` (`USER_PASSWORD_AUTH` via
  `InitiateAuth`), `app/api/login/route.ts`, username/password form in `app/login/page.tsx`.
  User Pool provisioned via `infra/cognito.yaml` (CloudFormation), admin-provisioned users
  only, first user `tim` created. `lib/session.ts` and `app/proxy.ts` were untouched by the
  swap, exactly as the spike predicted. Passkey login is still a v1.1 candidate (§9).
- [x] On successful login, issue app's own long-lived `httpOnly` `SameSite=Lax` secure session
  cookie (default 90-day expiry) — `lib/session.ts`, `app/api/login/route.ts`
- [x] Server-side session validation on protected routes (`app/proxy.ts` + a defensive check
  in each protected page, since Next 16's own docs warn a matcher change can silently drop
  Proxy coverage — see `app/today/page.tsx`)
- [x] Logout clears the cookie — `app/api/logout/route.ts` (no server-side session record to
  invalidate yet since there isn't a database-backed session store; revisit if that's needed)
- [ ] Row-level ownership check on every data read/write (never trust a client-supplied
  user_id) — applies once real DynamoDB data access exists (§1/§2)

## 4. Program engine (core logic, should be pure/unit-testable)

Already implemented and unit-tested (21/21 passing) in `spikes/program-engine/` — this
section is porting, not building from scratch:

- [ ] Port `nextWorkoutType`, `nextLiftState`, `generateWarmupSets`, `calculatePlates` and their tests from `spikes/program-engine/src|tests/` into `lib/program-engine/`
- [ ] Re-run the ported test suite in the real app's test runner to confirm nothing broke in the move
- [x] Wired these pure functions to the real DynamoDB-backed data — `app/app/today/page.tsx`
  (thin adapter as planned: fetch lifts + recent sessions, call the pure functions, render)

## 5. UI — workout flow (mobile-first)

- [x] Home/today screen: shows next workout (A/B), each lift with target weight x sets x reps
  — `app/app/today/page.tsx`, verified end-to-end against real Cognito + real DynamoDB data
  (see `docs/spikes.md` for the curl-driven verification). Bar weight / plate set are still
  hardcoded constants, not yet a Settings screen (§6).
- [ ] Set logging screen: large tap targets for "done" / "failed" per set, rest timer auto-starts after marking a set done
- [x] Warm-up sets shown before work sets, plate breakdown shown per set — done on the
  today screen (collapsed under a `<details>` for warm-ups); still needed on a future
  set-logging screen once that exists
- [ ] Rest timer component: countdown, audible/vibration alert at zero, skippable
- [ ] Session summary screen at end of workout (what was completed, weight changes for next time)

## 6. UI — history & settings

- [ ] Workout history list (past sessions, filterable by lift)
- [ ] Progress chart per lift (weight over time)
- [ ] Settings screen: units, bar weight, available plates, per-lift increments, rest timer duration, starting weights
- [ ] (Stretch) Bodyweight log entry + simple trend view

## 7. Cost verification

- [ ] Confirm the DynamoDB table is created with on-demand billing (not provisioned capacity)
- [ ] Add a loading skeleton for the home screen while the first DynamoDB read resolves (DynamoDB has no cold-start ACU ramp-up like Aurora did, but the first request after a Lambda cold start still has normal serverless latency — a skeleton is cheap insurance either way)

## 8. Deployment

- [ ] Connect repo to Amplify Hosting, verify SSR build works end-to-end
- [ ] Set up a budget alert threshold check-in (see `human-todo.md` for the actual AWS Budgets console step)
- [ ] Confirm a full cold-start → login → log a set → logout cycle works on a real phone over cellular data, not just Wi-Fi/desktop

## 9. Polish / v1.1 candidates (explicitly deferred)

- [ ] Passkey login instead of/alongside password
- [ ] Self-service invite flow for a second user
- [ ] Export workout history (CSV/JSON)
- [ ] Additional programs (Madcow, custom routines) — explicitly out of scope until v1 is used for a few weeks
