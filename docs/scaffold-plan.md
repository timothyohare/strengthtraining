# Next.js scaffold plan

What gets set up when the real app (not a spike) is created, and why. This is the app that
will eventually be deployed via Amplify Hosting — `spikes/` code gets ported into it per
`todo.md`, it doesn't start from the spikes directly.

## Decisions

- **Location:** `app/` at the repo root, sibling to `spikes/` and `docs/`.
- **Package manager:** pnpm (already used for both spikes, already installed).
- **Next.js:** App Router, TypeScript, ESLint — via the official `create-next-app` scaffold
  rather than hand-rolling config, so the project starts from a maintained baseline.
- **Styling:** Tailwind CSS — fastest path to the mobile-first, large-tap-target UI in
  `prd.md` §5 without hand-writing a design system for a single-user app.
- **PWA:** a hand-written `manifest.json` + minimal service worker (asset caching only, no
  offline-first sync — matches the PRD's explicit non-goal). `next-pwa`-style plugins tend to
  lag Next.js releases, so this is done manually rather than adding a dependency that might
  not track the installed Next.js version.
- **Session/auth stand-in (Spike 3):** since a real Cognito pool needs an AWS account that
  doesn't exist yet (`human-todo.md`), the scaffold includes a minimal signed-cookie session
  (`lib/session.ts` + `app/proxy.ts`) using a local HMAC secret as a stand-in for a
  Cognito-issued token. This proves out the "log in once, long-lived httpOnly cookie,
  server-validated on every request" architecture end-to-end locally. Swapping the stand-in
  login for real Cognito later is a login-route change, not an architecture change — the
  cookie/proxy/session-validation shape stays the same.
  **Correction during execution:** this app was scaffolded on Next.js 16, which renamed
  `middleware.ts` → `proxy.ts` (function renamed too). Confirmed by reading
  `node_modules/next/dist/docs/` — Next 16's scaffold ships an `AGENTS.md` warning that its
  APIs may differ from training data, and `middleware.js`'s own doc page confirms the
  rename/deprecation. Used `proxy.ts` throughout.
- **Program engine + DynamoDB access code:** ported from `spikes/program-engine/` and
  `spikes/dynamodb-schema/` per `todo.md` §2/§4, not written fresh.
- **Quality harness:** wired into the CLAUDE.md SDLC harness at
  `~/dev/newdev/code-build-harness/harness/gates/` via `.claude/harness.json` at the repo
  root, rather than left to autodetection. Autodetection alone doesn't find the app: it only
  looks for a Next.js frontend in a subdirectory when the *root* has a `pyproject.toml` (the
  Python-monorepo case), and this repo's root has no `package.json`/`pyproject.toml`/SAM
  marker — so without an explicit binding, `gate-ci` would silently resolve to
  `runtime: unknown` and no-op. Confirmed the binding resolves correctly with
  `resolve-cli.mjs --json` and that `gate-ci --full` passes for real against this app.
  `mockAws` is deliberately left unset for now — `gate-verify`'s `dynamodb-local` adapter
  expects a `docker compose up -d` at repo root, which doesn't exist until DynamoDB is
  actually wired into the app (`todo.md` §1/§2); add it then, with a root-level
  `docker-compose.yml` on the adapter's default port 8000.

## Steps

1. `pnpm dlx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"` (non-interactive flags to avoid prompts) — **done**. Note: it auto-`git init`'d inside `app/`; removed that nested repo since the whole project (`docs/`, `spikes/`, `app/`) should be one repo at the root (see `todo.md` §0, not yet done).
2. Verify the scaffold builds and lints cleanly (`pnpm build`, `pnpm lint`) — **done**
3. Add PWA manifest + a minimal service worker, wire into `app/layout.tsx` — **done** (`public/manifest.json`, `public/sw.js`, `public/icon.svg`, `app/service-worker-register.tsx`)
4. Add the session stand-in: `lib/session.ts` (sign/verify a cookie payload), `app/proxy.ts`
   (require a valid session on protected routes), a `/login` route that sets the cookie, and
   `/api/logout` that clears it — **done**
5. Add a smoke test proving the session flow works (login sets cookie → protected route
   succeeds → tampered cookie is rejected → logout clears it and re-blocks access) — **done**,
   driven with curl against the real dev server; see `docs/spikes.md` Spike 3 findings for the
   full transcript
6. Build a trivial "today's workout" placeholder page behind the session check, so there's a
   visible, protected page confirming the whole stack (Next.js + PWA shell + session proxy)
   is wired together — real data comes later per `todo.md` — **done** (`app/today/page.tsx`)
7. Confirm `pnpm build` still succeeds with everything wired in — **done**
8. Wire the CLAUDE.md SDLC harness (`.claude/harness.json`) and confirm `gate-ci --full`
   passes for real — **done**, not originally in this plan but decided during execution (see
   "Quality harness" above)

## Explicitly not in this pass

- Real Cognito integration (needs `human-todo.md` AWS setup first)
- Real DynamoDB wiring in the app (the spike proved the schema; porting it into `lib/db/` is
  `todo.md` §1/§2, done once the Amplify backend exists)
- Any of the actual workout UI beyond a placeholder page proving the auth wall works
- Amplify Hosting deployment (needs an AWS account — `human-todo.md`)
- `git init` at the repo root (todo.md §0 — deliberately left for the user rather than done
  silently, since it's the first commit of the whole project)
- `gate-verify` wiring (needs DynamoDB actually in the app first, see above)
