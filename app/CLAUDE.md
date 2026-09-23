@AGENTS.md

## Amplify deploy lessons (learned the hard way on sibling projects — nrl-predictor, rotrade)

- **Never delete `postcss.config.mjs`.** Without it, Tailwind directives pass through
  unprocessed and the site renders as unstyled HTML — the build still succeeds, so this is
  silent and easy to miss. This was nrl-predictor's actual production state for months
  (`docs/lessons/`, nrl-predictor repo) before anyone noticed. Verified in this repo:
  compiled CSS output contains real Tailwind utility rules (e.g. `.min-h-dvh{...}`), not a
  raw unprocessed `@import "tailwindcss"` — re-check this after any config cleanup.
- **Never add `amplify.yml`.** Amplify Hosting auto-detects a Next.js SSR app and runs its
  own Next.js adapter only when there's no custom build spec in the repo. A custom
  `amplify.yml` bypasses that adapter, `deploy-manifest.json` never gets generated, and the
  deploy step fails. See nrl-predictor's `docs/AMPLIFY_RECREATE.md` for the exact failure
  mode and recovery.
- **Never add `output: "export"` to `next.config.ts`.** Breaks SSR/ISR — this app needs SSR
  for the session-gated pages (`app/proxy.ts`) — and search crawlers get an empty shell.
- Amplify sets `AWS_COMMIT_ID` on every build; bake it into a `GIT_SHA` env var in
  `next.config.ts` if a "deployed commit" marker is ever wanted (nrl-predictor's
  `frontend/next.config.ts` has the exact pattern).

## Cognito

Real Cognito wiring (not a stand-in) is live — see `lib/cognito.ts`, `infra/cognito.yaml`,
and `docs/spikes.md` Spike 3. Local dev needs `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`,
`COGNITO_CLIENT_SECRET`, `COGNITO_REGION` in `.env.local` (gitignored, not committed —
see `docs/human-todo.md` if these need regenerating).
