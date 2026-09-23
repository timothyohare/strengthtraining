# PRD — Lift5 (working name)

Status: Draft v1
Owner: Tim
Last updated: 2026-09-23

## 1. Summary

A mobile-friendly web app that implements the StrongLifts 5x5 strength-training method: automated A/B workout scheduling, linear weight progression, deload handling, warm-up/plate calculators, rest timer, and workout history/progress charts. Multi-user capable, single-tenant in practice. Built to minimize idle cost on AWS (Next.js + Amplify + DynamoDB).

## 2. Problem

- The official StrongLifts app now requires a subscription and paywalls core features (warm-up calculator, custom routines, full history).
- The training method itself is simple, public, and doesn't need a subscription product behind it.
- Existing free alternatives (spreadsheets, generic workout-log apps) don't encode the program's specific rules (A/B alternation, per-lift increments, 3-strikes deload, 3x5 fallback) — the user has to do that bookkeeping manually.

## 3. Goals / non-goals

**Goals**
- Encode the StrongLifts 5x5 program rules so the app tells the user exactly what to lift, every session, with no manual tracking.
- Mobile-first UI usable one-handed, standing at a rack, between sets.
- Persistent login via cookie — sign in once, not before every workout.
- Near-zero infrastructure cost when not actively training.
- Multi-user data model from day one (auth + per-user data isolation), even though only one user is expected.

**Non-goals (v1)**
- Other programs (Madcow, 5/3/1, custom routine builder).
- Payments, subscriptions, or any monetization.
- Social features (sharing, leaderboards, following).
- Nutrition/bodyweight coaching content.
- Native iOS/Android apps (PWA only).
- Offline-first full sync (basic asset caching only; requires network for logging a set).
- Wearable integration (Apple Watch, etc.).

## 4. Users

- **Primary user (v1):** the app's creator. Trains 3x/week, wants minimal friction mid-workout.
- **Secondary users (future):** invited family/friends, each with fully isolated accounts and history. Not built in v1 beyond ensuring the data model supports it (no shared/global state).

## 5. Feature set (derived from StrongLifts 5x5)

Program mechanics researched and confirmed as of 2026:

- Two alternating workouts, 3x/week:
  - **Workout A:** Squat 5x5, Bench Press 5x5, Barbell Row 5x5
  - **Workout B:** Squat 5x5, Overhead Press 5x5, Deadlift 1x5
- App remembers which workout (A/B) was last completed and presents the correct next one.
- **Progression:** on a fully completed lift (all sets x all reps), increase that lift's working weight next time it's programmed. Default increments configurable per lift (e.g., +5 lb/+2.5 kg upper body, +10 lb/+5 kg deadlift — exact defaults are a config value, not hardcoded).
- **Deload:** three consecutive failed sessions on a lift (any set not completed at full reps) triggers a 10% weight reduction on that lift.
- **3x5 fallback:** a second deload on the same lift drops it from 5x5 to 3x5 (3 sets of 5) permanently for that lift, per the standard program rule.
- **Warm-up calculator:** given a work-set weight, generates a ramp-up sequence of warm-up sets (e.g., empty bar, then increasing percentages) — this was specifically called out as paywalled in the real app, so it's a must-have here.
- **Plate calculator:** given target weight, bar weight, and available plates, shows plates-per-side.
- **Rest timer:** countdown timer between sets (default ~3–5 min, configurable), with an audible/vibration alert.
- **Set logging:** big tap targets to mark a set done/failed, with weight x reps visible at a glance; minimal typing required mid-workout.
- **Workout history / logbook:** past sessions, per-lift weight history.
- **Progress charts:** weight-over-time per lift.
- **Settings:** units (kg/lb), bar weight, available plate sizes, per-lift increments, rest timer duration, starting weights.
- **Bodyweight tracking (stretch, v1.1):** optional log of bodyweight over time.

## 6. Auth & session model

- Single identity provider (Amazon Cognito) backing a "multi-user, effectively single-tenant" model.
- User signs in once (email/password or passkey — decide during build); on success, a secure, `httpOnly`, `SameSite=Lax` session cookie is set with a long expiry (default 90 days, configurable).
- No re-authentication required for the cookie's lifetime; server-side session validation on each request via the cookie.
- Each user's workout data is scoped by user ID at the database layer (row-level ownership, enforced in every query — not just at the API surface).
- No self-service sign-up flow in v1 — new users are provisioned manually (admin adds them in Cognito) since the user base is invite-only.

## 7. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router), React | Mobile-first, PWA manifest for home-screen install |
| Hosting | AWS Amplify Hosting | SSR via Amplify's Next.js support; scales to $0-ish compute when idle (pay-per-request) |
| Auth | Amazon Cognito | Free tier comfortably covers 1–10 users; issues session backing the app's own cookie |
| Database | **DynamoDB** (on-demand billing), single table | True pay-per-request pricing, no idle compute/storage floor to babysit, no cold-start scaling behavior. Table design and every v1 access pattern validated in `spikes/dynamodb-schema/` — see `spikes.md` |
| Data access | AWS SDK v3 (`@aws-sdk/lib-dynamodb`) directly, no ORM | A single-table design with a handful of hand-written access-pattern functions (see spike) doesn't need an ORM layer |
| IaC | AWS Amplify Gen 2 (TypeScript backend) | Keeps infra-as-code colocated with the app repo |

### Alternatives considered

- **Aurora Serverless v2 (PostgreSQL):** the original default. Rejected after the DynamoDB
  schema spike (`spikes.md`) confirmed a single DynamoDB table with zero secondary indexes
  serves every v1 access pattern (today's workout, deload-streak lookup, full history,
  per-lift progress charts) at this app's scale. DynamoDB gets closer to literal $0 idle cost
  (no storage floor, no cold-start ACU ramp-up) and needs no connection-pooling workaround
  from serverless functions. Revisit only if the app ever needs real relational queries
  (ad-hoc joins across many users) that a single-table design can't serve — not expected for
  a personal-scale tracker.

## 8. Cost model (honesty check on "zero cost when not in use")

- **Amplify Hosting:** free tier covers low-traffic personal use; beyond that, pay-per-build-minute and per-GB-served. Effectively $0/month at this usage level.
- **Cognito:** free for the first 10,000–50,000 MAUs depending on tier; $0/month for 1–5 users.
- **DynamoDB (on-demand):** no minimum capacity, no idle compute cost, and storage for a personal workout log (well under 1 GB, likely a few MB for years of data) is pennies at DynamoDB's per-GB rate — effectively **$0/month when idle**, the closest of any option considered to the literal target.
- **Data transfer:** negligible at this scale.
- **Net: realistically $0/month in idle weeks**, versus the ~$1/mo storage/backup floor Aurora would have carried. This is the main reason the DynamoDB switch was worth the spike time.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Single-table DynamoDB design is unfamiliar/less flexible than SQL if requirements grow | Harder to bolt on an unanticipated query pattern later | Access patterns were deliberately enumerated and spiked up front (`spikes.md`); a genuinely new pattern can usually be served by a new item type or a targeted GSI without a full redesign |
| Single-admin-provisioned auth (no self-serve sign-up) | Fine for v1's single user; friction if inviting others later | Documented as a known v1 limitation, not a blocker |
| Manual AWS account/infra setup | Human-only steps (billing alerts, domain, Cognito user creation) can't be automated by the coding agent | Captured explicitly in `human-todo.md` |
| Scope creep toward "just rebuild StrongLifts fully" | Delays a working v1 | Non-goals section above is the guardrail — revisit only after v1 ships and is used for a few weeks |

## 10. Success criteria

- User can sign in once and stay logged in on their phone across a normal week of training without re-entering credentials.
- App correctly sequences Workout A/B and applies progression/deload rules without manual correction, verified against at least 4 weeks of simulated training data (see `verification-plan.md`).
- Warm-up and plate calculators produce correct output for a range of weights/bar/plate configurations.
- Monthly AWS bill stays under $1 during weeks with no training activity.
- Core "log a set" interaction (open app → see today's workout → mark set done) takes under 3 taps from a cold app open.
