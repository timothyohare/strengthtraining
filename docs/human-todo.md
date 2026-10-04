# TODO — Human-only

Steps that require a human with account/billing/identity authority — a coding agent cannot
do these (no credentials, or they're genuinely irreversible/billing-sensitive decisions).
Do these roughly in order; later engineering tasks in `todo.md` depend on several of them.

## AWS account setup

- [x] Confirmed: this project uses the existing account `810429055117` (same account
  nrl-predictor and rotrade already run in — working CLI credentials found for IAM user
  `timohare_win_home`), not a fresh dedicated account. **Worth revisiting deliberately**: a
  shared account means this project's blast radius/billing isn't isolated from the others —
  if that separation matters to you, a dedicated account is still an option, just not what
  got used for the first real resource (see Cognito below).
- [ ] Enable MFA on the AWS root user if not already on (not verified from here)
- [ ] Confirm the existing IAM user (`timohare_win_home`) has appropriately scoped
  permissions for day-to-day deploys rather than broad/root-equivalent access — not checked
- [x] AWS Budget with alerts (2026-10-04): `monthly-account-60usd`, account-wide $60/month,
  emails timohare@gmail.com when actual spend passes 80% ($48) or the month's forecast passes
  100% ($60). Not the $5 originally suggested: the shared account already runs ~$29–40/month
  from other projects (S3, RDS, KMS), so $5 would alert every month. Lift5's own share is
  well under $5; this budget catches a runaway anywhere in the account, not Lift5 alone.
- [x] AWS region: `ap-southeast-2` (Sydney) — matches the existing nrl-predictor/rotrade
  footprint in this account. Cognito User Pool is live there (see below).

## Domain & hosting

- [x] Domain: https://strength.ohare.id.au (2026-10-04). `ohare.id.au` is a Route 53 hosted
  zone in this account; the Amplify domain association (prefix `strength` → branch `main`)
  created the CNAME and ACM validation records itself, with an Amplify-managed certificate.
  The default https://main.d19xtyaa53gf8v.amplifyapp.com still works too.

## Identity / auth

- [x] Cognito User Pool deployed (`infra/cognito.yaml`, stack `lift5-cognito`,
  `ap-southeast-2`) and the first user created: username `tim`, admin-provisioned (no
  self-service sign-up), permanent password set via CLI.
- [x] Login method: plain username + password (`USER_PASSWORD_AUTH`), not email-based and
  not passkey — kept simple since sign-up is admin-only anyway. Passkey remains a v1.1
  candidate (`todo.md` §9) if wanted later.
- [ ] **Store the login credential in your password manager now** — the generated password
  was shown once in the chat response that did this setup and is not saved anywhere else (not
  in this repo, not in any file). If it's lost, reset it yourself:
  `aws cognito-idp admin-set-user-password --user-pool-id <id> --username tim --password '<new>' --permanent --region ap-southeast-2`
  (get `<id>` from `aws cloudformation describe-stacks --stack-name lift5-cognito --region ap-southeast-2 --query "Stacks[0].Outputs"`)
- [ ] There's no self-service "forgot password" or "change password" flow built yet — add one
  if that becomes annoying. Now the most useful missing feature, since the live app is in
  daily use (tracked in `todo.md` §9)

## Cost verification (ongoing, not one-time)

- [ ] After first deploy, check the AWS Cost Explorer / Billing dashboard after one full idle week to confirm actual idle cost matches the PRD's estimate (~$1/month or less)
- [x] DynamoDB table is on on-demand billing (`PAY_PER_REQUEST`), confirmed with
  `aws dynamodb describe-table` (see `todo.md` §7)

## Ongoing/no rush

- [ ] Decide if/when to invite a second user (spouse, training partner) — triggers the deferred self-service invite work in `todo.md` §9
- [ ] Periodically review the AWS bill for the first couple months until the cost pattern is trusted
