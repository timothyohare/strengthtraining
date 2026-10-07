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
- [x] Amplify SSR compute role `lift5-amplify-compute-dev` via `infra/amplify-role.yaml`
  (stack `lift5-amplify-role`): `GetItem`/`PutItem`/`Query`/`UpdateItem` on `lift5-dev` only, trusted by
  `amplify.amazonaws.com`. Cognito login uses the app client secret, so no Cognito IAM
  permissions. Add `DeleteItem` there if the app ever issues that command.
- [x] **No `amplify.yml` in the repo** — see `app/CLAUDE.md`'s "Amplify deploy lessons".
  The build spec lives in the Amplify console (App settings → Build settings) instead, and
  this is the only copy outside AWS:

  ```yaml
  version: 1
  applications:
    - frontend:
        phases:
          preBuild:
            commands:
              - nvm use 22                      # Next 16 needs Node >= 20.9
              - npm install -g pnpm@11.20.0     # must match packageManager in package.json
              - pnpm install --frozen-lockfile
          build:
            commands:
              # Console env vars exist only at build time; this makes them visible to
              # the SSR runtime. None are NEXT_PUBLIC_, so none reach the browser.
              - env | grep -E '^(COGNITO_|SESSION_SECRET|DYNAMODB_TABLE|VAPID_PUBLIC_KEY|REST_PUSH_FUNCTION)' >> .env.production
              - pnpm run build
        artifacts:
          baseDirectory: .next
          files:
            - "**/*"
        cache:
          paths:
            - .next/cache/**/*
            - node_modules/**/*
      appRoot: app
  ```

  Why the pnpm pin: an unpinned `npm install -g pnpm` installs a newer pnpm, which then
  downloads its standalone 11.20.0 build to honour `packageManager`; that build needs
  `libatomic.so.1`, which the Amplify image lacks (and `dnf install` isn't allowed there).
  Bump the pin whenever `packageManager` changes.

  Console env vars: `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_REGION`,
  `COGNITO_USER_POOL_ID`, `DYNAMODB_TABLE` (`lift5-dev`), `SESSION_SECRET` (prod-only random
  value, not in `.env.local`). `AWS_*` names are reserved by Amplify and can't be set.
- [x] Environment separation — **decided 2026-10-04: single environment, keep the "dev"
  names.** The live site at https://strength.ohare.id.au runs on the resources created with
  `StageName=dev` (`lift5-dev` table, `lift5-users-dev` pool, `lift5-amplify-compute-dev`
  role), and these are the production resources despite the name. No separate prod stack:
  for a personal-scale app, a second set of resources and a rename/data migration would add
  cost and work for no real benefit. Consequences to remember:
  - Local dev (`.env.local`) talks to the same table and user pool as the live site, so
    test against DynamoDB Local (`DYNAMODB_ENDPOINT`) when trying anything destructive.
  - Don't delete or recreate the `lift5-dynamodb`, `lift5-cognito` or `lift5-amplify-role`
    stacks on the assumption that "dev" means disposable.
  - If a real prod split is ever wanted, deploy the same templates with `StageName=prod`.

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
- [x] **Fixed known gap:** the deload → 3x5 fallback rule in `lib/program-engine/progression.ts`
  now only drops `setCount` to 3 when the lift currently runs more than 3 sets, so a second
  deload on Deadlift's 1-set program no longer incorrectly bumps it to 3 sets. Covered by a
  new test (`does not raise a single-set lift (Deadlift) to 3x5 on a second deload`); 22/22
  tests pass, `gate-ci --full` green.

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
- [x] Row-level ownership check on every data read/write (never trust a client-supplied
  user_id) — `app/app/today/actions.ts`'s `finishWorkoutSession` derives `userId` from the
  verified session cookie itself, never from client-supplied input

## 4. Program engine (core logic, should be pure/unit-testable)

Already implemented and unit-tested (21/21 passing) in `spikes/program-engine/` — this
section is porting, not building from scratch:

- [x] Ported `nextWorkoutType`, `nextLiftState`, `generateWarmupSets`, `calculatePlates` and their tests from `spikes/program-engine/src|tests/` into `app/lib/program-engine/`
- [x] Re-ran the ported test suite in the app's own runner (`pnpm test`, vitest) — 21/21 pass, wired into `.claude/harness.json`
- [x] Wired these pure functions to the real DynamoDB-backed data — `app/app/today/page.tsx`
  (thin adapter as planned: fetch lifts + recent sessions, call the pure functions, render)

## 5. UI — workout flow (mobile-first)

- [x] Home/today screen: shows next workout (A/B), each lift with target weight x sets x reps
  — `app/app/today/page.tsx`, verified end-to-end against real Cognito + real DynamoDB data
  (see `docs/spikes.md` for the curl-driven verification). Bar weight / plate set are still
  hardcoded constants, not yet a Settings screen (§6).
- [x] Set logging screen: large tap targets for "done" / "failed" per set — `WorkoutSession.tsx`
  (client component) + `actions.ts` (`finishWorkoutSession` server action). Rest timer
  auto-starts after marking any set (done or missed), matching the spec.
- [x] Warm-up sets shown before work sets, plate breakdown shown per set — done on the
  today screen (collapsed under a `<details>` for warm-ups)
- [x] Rest timer component: countdown (180s), audible beep (Web Audio oscillator) + vibration
  at zero, skippable — built into `WorkoutSession.tsx` rather than a separate component, since
  it's only ever used inline with set logging
- [x] Session summary screen at end of workout (what was completed, weight changes for next
  time) — `finishWorkoutSession` (`actions.ts`) now returns a per-lift summary (previous
  weight, new weight, sets completed, deload/set-count-drop flags); `WorkoutSession.tsx`
  renders it in place after "Finish workout" instead of redirecting immediately, with a
  "Back to today" button to return to `/today`

**Verification note:** browser automation (chrome-devtools MCP, claude-in-chrome) was
unavailable in this environment, so the interactive UI (button clicks, the rest timer's
client-side countdown) was not literally click-tested. What *was* verified for real against
the live Cognito user and live DynamoDB table: the exact read→compute→write sequence the
server action performs (a throwaway script exercising `getAllLifts`/`nextLiftState`/
`putSession`/`putLift` end-to-end — Squat/Bench/Row all correctly incremented by their
configured increment, the session was correctly recorded as most-recent, and the next `/today`
load correctly alternated to Workout B and rendered the updated weights). `gate-ci --full`
(lint/typecheck/test/build) is green, including a real bug the lint step caught (synchronous
`setState` inside a `useEffect` in the rest-timer logic, fixed properly rather than suppressed).

**Summary screen verification note:** no known password for the live Cognito user `tim` was
available in this session (not stored in the repo, by design), so the summary screen wasn't
click-tested live against Cognito/DynamoDB — resetting Tim's real login or mutating his real
lift progression data just to test a UI addition wasn't worth the side effect. Instead, the
new summary-derivation math in `finishWorkoutSession` (previous/new weight, deload flag,
set-count-drop flag) was verified with a throwaway script driving the same `nextLiftState`
function across four scenarios (full completion, first deload, second deload triggering the
3x5 set-count drop, single miss with no deload yet) — all four produced the expected summary
fields. `gate-ci --full` is green. Still open: an actual click-through of the new summary view
in a real browser.

## 6. UI — history & settings

- [x] Workout history list (past sessions, filterable by lift) — `app/history/page.tsx`,
  reuses the already-validated `getAllSessions` access pattern from `lib/db/schema.ts`;
  lift filter is a plain `?lift=` query param (server component, no client JS needed). Linked
  from the today screen header. Verified end-to-end against the real Cognito user's live
  DynamoDB data: a locally-minted dev session cookie (the app's own `createSessionToken`,
  dev fallback secret — no Cognito password needed, no data mutated) against a real `pnpm dev`
  boot showed the one real logged session's three lifts unfiltered, correctly narrowed to just
  Squat when filtered, and confirmed the auth redirect for a request with no cookie. Interactive
  click-testing still wasn't possible (Chrome extension not connected in this environment).
- [x] Progress chart per lift (weight over time) — `app/history/ProgressChart.tsx`, plain inline
  SVG (no charting dependency) rendered inside `/history` when a lift filter is active; points
  colored by completed/missed, a `<details>` table view underneath for accessibility, and a
  same-weight-plateau fallback message under 2 points. Verified with a throwaway
  `renderToStaticMarkup` render against synthetic multi-point data (real data only has one
  logged session so far) — caught and fixed a real bug this way: SVG `<title>` tooltips need a
  single string child, not multiple JSX expressions, or React warns and drops them. `gate-ci
  --full` green.
- [x] Settings screen: units, bar weight, available plates, per-lift increments, rest timer
  duration, starting weights — `app/settings/page.tsx` + `app/settings/actions.ts`. New
  `SETTINGS#<userId>` item (`lib/db/schema.ts`: `SettingsItem`/`putSettings`/`getSettings`/
  `DEFAULT_SETTINGS`) alongside the existing `PROFILE.units` field. Design: stored weight
  fields (lift currentWeight/increment/roundTo, settings barWeight/availablePlates) are always
  in whatever unit `PROFILE.units` currently says, with **no conversion at display time**;
  the only conversion math (`lib/units.ts`) runs in one place — switching units — which
  re-expresses every already-stored weight in the new unit so nothing needs re-entering just
  because the label changed. Editing individual values is a separate action that never
  converts, it just stores what's typed. Tim confirmed metric (kg) is his priority, and his
  real seeded profile/lifts turned out to still have the placeholder `units: "lb"` +
  imperial numbers the seed script's own comment flagged as needing Settings to fix — kg is
  now the default for `DEFAULT_SETTINGS` and `scripts/seed.ts`; `today`/`history`/
  `WorkoutSession`/`ProgressChart` all read `profile.units` instead of hardcoding "lb".
  Verified: the switch-units conversion logic end-to-end against real DynamoDB using a
  throwaway test userId (seeded, converted, round-tripped, asserted, then deleted — confirmed
  clean afterward, never touched Tim's real `tim` data); `/settings` and `/today` read-path
  rendering verified live against Tim's real profile/lift data (GET only, via a locally-minted
  session cookie — no form submission against real data, since that would overwrite his real
  progression numbers with test input). `gate-ci --full` green.
- [ ] (Stretch) Bodyweight log entry + simple trend view

## 7. Cost verification

- [x] Confirmed the DynamoDB table is created with on-demand billing (not provisioned capacity) — `aws dynamodb describe-table` shows `PAY_PER_REQUEST`
- [x] Add a loading skeleton for the home screen while the first DynamoDB read resolves —
  `app/today/loading.tsx`, using Next's `loading.js` file convention (auto-wraps the route in
  a Suspense boundary, shown until `page.tsx`'s async data fetch resolves). `gate-ci --full`
  green; confirmed `/today` still loads correctly with it present.

## 8. Deployment

- [x] Connected repo to Amplify Hosting (app `d19xtyaa53gf8v`, branch `main`, monorepo root
  `app`); SSR build and login → workout → save verified on the live site. Live at
  https://strength.ohare.id.au (see `human-todo.md` → Domain & hosting).
  - Redirects must not be built from `request.url`: behind Amplify's proxy it reports
    `localhost:3000`. Use `lib/redirect.ts` (`redirectTo` in route handlers, `publicUrl` in
    `proxy.ts`).
- [x] Budget alert set up — `monthly-account-60usd`, details in `human-todo.md`
- [ ] Confirm a full cold-start → login → log a set → logout cycle works on a real phone over cellular data, not just Wi-Fi/desktop

## 9. Polish / v1.1 candidates (explicitly deferred)

- [x] Change-password screen in Settings (Cognito `ChangePassword`) — `app/settings/password/`
  (linked from Settings). `lib/cognito.ts` `changeCognitoPassword` re-authenticates with the
  current password (`InitiateAuth`) to get an access token, then calls `ChangePassword`, so
  still no IAM role needed. Client-side rules mirror the pool policy (`lib/password.ts`, keep
  in step with `infra/cognito.yaml`). Verified locally: mismatch and wrong-current-password
  paths against the real pool; the success path is not yet exercised (would change `tim`'s
  real password) — try it once on the live site
- [x] Logout and password change really end sessions — tokens carry `issuedAt`, the profile
  carries `sessionsValidAfter`, and `lib/auth.ts` `getSession` checks both (proxy, pages and
  actions all use it). Signs out every device. Proved by `gate-verify`'s acceptance checks
  (`app/scripts/gate/`), which run against DynamoDB Local, never `lift5-dev`
- [x] Adjust a lift's weight mid-workout — tap the weight on `/today` for a full-screen
  adjuster (steps from the smallest plate, live plate breakdown); `setLiftWeight` in
  `app/today/actions.ts` saves it. It must not call `revalidatePath`: that refreshes `/today`,
  remounts the workout and wipes the logged sets (found by click-testing)
- [x] Workout in progress survives leaving `/today` (Settings, reload, iOS unloading the tab)
  — kept in localStorage per user (`lib/workout-progress.ts`), restored for today's workout of
  the same type, cleared on finish. Per device only
- [x] Rest timer keeps real time while the page is hidden — stores the end time and works the
  remainder out from the clock; no late beep on return
- [ ] Rest-over notification while the app is in the background — **code done, not yet
  deployed.** iOS pauses a backgrounded web app, so the server sends it: each rest start calls
  `scheduleRestAlert` (`app/rest-alerts/actions.ts`), which writes a `REST_TIMER` item and
  async-invokes `lift5-rest-push-dev` (`app/lambda/rest-push/index.mjs`,
  `infra/rest-push.yaml`). The Lambda polls that item every 5s (so Skip/+30s/next set
  supersede it), then sends an empty VAPID-signed Web Push to each `PUSHSUB#` item;
  `public/sw.js` shows the text. Settings → Rest alerts turns it on per device (iPhone: Home
  Screen app only). Verified locally: unit tests, plus the real handler against DynamoDB Local
  and a fake push service (on-time send, signature, skip, supersede, 410 cleanup). Not
  verifiable here: a real subscription (automated Chrome can't register for push) — test on
  the iPhone after deploy. Deploy steps:
  1. VAPID keys: generate a P-256 pair; the private key goes only into the stack parameter
     (keep a copy in the password manager; losing it just means re-enabling alerts per device)
  2. `aws cloudformation deploy --template-file infra/rest-push.yaml --stack-name
     lift5-rest-push --capabilities CAPABILITY_NAMED_IAM --parameter-overrides
     VapidPublicKey=… VapidPrivateKey=…`, then `infra/deploy-rest-push.sh`
  3. Redeploy `infra/amplify-role.yaml` (adds `DeleteItem` and `lambda:InvokeFunction`)
  4. Amplify env vars `VAPID_PUBLIC_KEY` and `REST_PUSH_FUNCTION=lift5-rest-push-dev`, and
     add both to the build spec's `env | grep` line (§1)
- [ ] Self-service invite flow for a second user
- [ ] Export workout history (CSV/JSON)
- [ ] Additional programs (Madcow, custom routines) — explicitly out of scope until v1 is used for a few weeks
