# Spikes

A spike is throwaway/proof-of-concept code that answers one specific technical question
before it gets baked into the real app. These live in `spikes/` (not `app/`), are allowed to
be rough, and each one ends with a written finding below. None of them require an AWS
account — that's the point: retire as much technical risk as possible locally, so the
human-only AWS setup in `human-todo.md` only has to happen once, with confidence.

Follows from the last decision: **DynamoDB replaces Aurora** as the default choice (true
pay-per-request pricing, no storage floor to babysit, no cold-start ACU scaling to worry
about). `prd.md` §7 will be updated to reflect this once the schema spike below confirms the
single-table design actually serves the app's query patterns.

## Spike 1 — Program engine core logic

**Question:** Do the StrongLifts progression/deload/warm-up/plate rules from `prd.md` §5
actually work as pure, testable functions — before wiring them to any UI or database?

**Method:** Pure TypeScript functions + Vitest unit tests, no framework, no I/O.
- `nextWorkoutType` — A/B alternation
- `nextLiftState` — progression, 3-strike deload (10%), double-deload → 3x5 fallback
- `generateWarmupSets` — ramp-up sequence to a work weight
- `calculatePlates` — plates-per-side, including weights not exactly loadable

**Location:** `spikes/program-engine/`

**Status:** executed — see Findings below.

## Spike 2 — DynamoDB single-table schema

**Question:** Can a single DynamoDB table (no GSIs) actually serve every query the app
needs — today's workout, deload-streak lookups, full history, per-lift progress charts —
given this app's scale (one to a handful of users, a few hundred sessions/year)?

**Method:** Run DynamoDB Local in Docker, create the proposed table, seed realistic sample
data (1 user, 2 lifts, several sessions with sets), and execute each access pattern as a real
`Query`/`GetItem` call — not just a design doc.

**Location:** `spikes/dynamodb-schema/`

**Status:** executed — see Findings below.

## Spike 3 — Auth session cookie plumbing

**Question:** Does the "log in once, long-lived httpOnly cookie, server-validated on every
request" session model from `prd.md` §6 actually work cleanly in Next.js middleware/route
handlers — before wiring it to a real Cognito user pool (which needs an AWS account)?

**Method:** A minimal signed-JWT session (stand-in for a Cognito-issued token) set as a
secure cookie by a login route, validated in Next.js middleware, rejected once
tampered/expired. This is naturally a Next.js-runtime concern, so it's executed as part of
scaffolding the real app (`app/lib/session.ts` + `middleware.ts`) rather than as separate
throwaway code — see `todo.md` §3 for the follow-up to swap the stand-in for real Cognito.

**Status:** executed as part of Next.js scaffolding — see `docs/scaffold-plan.md`.

**Result: PASS**, with one correction to the original plan: this app was scaffolded on
**Next.js 16**, which deprecated `middleware.ts` and renamed it to `proxy.ts` (same runtime
behavior, new file/export name — confirmed by reading `node_modules/next/dist/docs/` per the
version's own `AGENTS.md` warning, not assumed from training data). Built `lib/session.ts`
(HMAC-signed cookie, 90-day expiry) + `proxy.ts` (session guard) + `/login`, `/api/login`,
`/api/logout` routes + a protected `/today` placeholder, then drove the real dev server with
curl end-to-end:
1. `GET /today` unauthenticated → `307` to `/login` ✓
2. `POST /api/login` wrong password → redirect back to `/login?error=1`, no cookie set ✓
3. `POST /api/login` correct password → `303` to `/today`, `Set-Cookie` with `HttpOnly`,
   `SameSite=lax`, `Max-Age=7776000` (90 days) ✓
4. `GET /today` with the valid cookie → `200` ✓
5. `GET /today` with a byte flipped in the cookie's signature → `307` to `/login` (HMAC
   verification correctly rejects tampering) ✓
6. `POST /api/logout` → `303` to `/login`, `Set-Cookie` expiring the cookie immediately ✓
7. `GET /today` after logout → `307` to `/login` again ✓

The architecture holds. Swapping the stand-in login for real Cognito later only touches
`app/api/login/route.ts` (issue the app's own cookie after a real Cognito auth instead of a
password check) — `lib/session.ts`, `proxy.ts`, and every protected page's defensive check
stay as-is.

**Update — the swap is done, not just proven.** A real Cognito User Pool is deployed
(`infra/cognito.yaml`, CloudFormation, account `810429055117`, region `ap-southeast-2` — the
same account/region nrl-predictor already runs in) with admin-provisioned users only (no
self-service sign-up, per `prd.md` §6). `app/api/login/route.ts` now calls
`lib/cognito.ts`'s `verifyCognitoCredentials` (Cognito's `USER_PASSWORD_AUTH` flow via
`InitiateAuth`, secured with a client secret + `SECRET_HASH` — a public, unauthenticated
Cognito API, so neither local dev nor the deployed app needs an AWS IAM role just to log in)
in place of the password comparison. Re-ran the exact same curl sequence above against the
real user pool with the real user `tim`: wrong password → `redirect` with no cookie; correct
password → `303` with a valid session cookie; protected page correctly rendered "Signed in as
tim". Everything else in the architecture (`lib/session.ts`, `app/proxy.ts`, the today-page
defensive check) is unchanged, exactly as predicted.

**IaC choice for Cognito:** plain CloudFormation (`infra/cognito.yaml`), not CDK or Amplify
Gen 2's `defineAuth`. Considered Amplify Gen 2 (the user's suggestion) but its exact config
surface for disabling self-signup and enabling `USER_PASSWORD_AUTH` wasn't something
verifiable without live docs access in this environment, whereas a hand-written
CloudFormation template was fast to get right and deploy with confidence — and matches
rotrade's stated preference ("CloudFormation, not Terraform/CDK — AWS-native, no extra
toolchain dependency", `rotrade/infra/README.md`). Revisit Amplify Gen 2 once DynamoDB is
also being provisioned, if unifying both under one TypeScript-defined backend looks
worthwhile then.

---

## Findings

### Spike 1 — Program engine

- All four functions implemented and unit-tested against the rules in `prd.md` §5,
  including the edge cases called out in `verification-plan.md` §1 (deload streak reset on a
  single success, double-deload → 3x5 fallback persisting, plate weights that aren't exactly
  loadable, overshoot-vs-undershoot plate selection).
- **Result: PASS.** 21/21 tests green (`pnpm test` in `spikes/program-engine/`):
  `nextWorkoutType` (4), `nextLiftState` (6), `generateWarmupSets` (5), `calculatePlates` (6).
  The rules translate cleanly into pure functions with no surprises — safe to port directly
  into the real app's `lib/program-engine/` once scaffolded.
- One real design decision the spike forced: plate selection needs an "is a small overshoot
  closer than the undershoot" check, not pure greedy-floor — a naive greedy implementation
  would have quietly returned a worse answer on odd targets. Worth remembering when this code
  gets ported, not just copied.

### Spike 2 — DynamoDB schema

- Proposed table: `PK = USER#<userId>`, `SK = PROFILE | LIFT#<liftName> | SESSION#<isoDate>#<sessionId>`.
- Sets are embedded as an attribute list on the `SESSION` item rather than modeled as
  separate items. Justification: sets are always read/written in the context of their parent
  session, the list is small and bounded (a handful of sets per session), and embedding
  avoids an item-per-set explosion for no benefit at this scale.
- **Result: PASS.** Ran `pnpm spike` in `spikes/dynamodb-schema/` against a real DynamoDB
  Local container (`docker compose up`), seeded 1 user / 2 lifts / 5 sessions, and executed
  every access pattern from `prd.md` §5 as a live `Query`/`GetItem` call:
  - Get profile → `GetItem` PK+SK
  - Get all current lift states (for "today's targets") → `Query` `begins_with(SK, "LIFT#")`
  - Most recent session (for next A/B decision) → `Query` `begins_with(SK, "SESSION#")`,
    `ScanIndexForward=false`, `Limit=1`
  - Full session history → same query, no limit, ascending for chronological display
  - Per-lift progress-chart data → full session query + in-memory filter/map over the
    embedded `sets` array
  - Deload-streak lookup (last N results for one lift) → most-recent-sessions query + filter
  - **Zero secondary indexes needed for any of it**, confirming the "personal scale means an
    in-memory filter beats a GSI" bet from the PRD. Revisit only if this ever needs to serve
    dozens of concurrent users with large histories — not a v1 concern.
- Table design is locked in as the v1 data model. `prd.md` §7 updated to replace Aurora with
  DynamoDB (on-demand billing) as the primary datastore.
