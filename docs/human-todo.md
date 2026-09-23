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
- [ ] **Set up an AWS Budget with an alert** (e.g., alert at $5/month) — **this has not been
  done yet, and real billable resources now exist in this account for this project** (a
  Cognito User Pool — free tier covers this easily, but the budget alert is still the
  intended safety net per `prd.md`'s cost model). Do this now, don't wait.
- [x] AWS region: `ap-southeast-2` (Sydney) — matches the existing nrl-predictor/rotrade
  footprint in this account. Cognito User Pool is live there (see below).

## Domain & hosting

- [ ] Decide on a domain (buy one, or use the free `*.amplifyapp.com` subdomain Amplify Hosting provides — recommend starting with the free subdomain and adding a custom domain later if desired)
- [ ] If using a custom domain, purchase/transfer it and note where it's registered (Route 53 or elsewhere) — DNS setup is a manual Amplify console step

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
  if that becomes annoying (low priority for a single admin-provisioned user)

## Cost verification (ongoing, not one-time)

- [ ] After first deploy, check the AWS Cost Explorer / Billing dashboard after one full idle week to confirm actual idle cost matches the PRD's estimate (~$1/month or less)
- [ ] Confirm the DynamoDB table is on on-demand billing (not provisioned capacity) in the AWS console — provisioned mode would reintroduce an idle cost this stack is specifically avoiding

## Ongoing/no rush

- [ ] Decide if/when to invite a second user (spouse, training partner) — triggers the deferred self-service invite work in `todo.md` §9
- [ ] Periodically review the AWS bill for the first couple months until the cost pattern is trusted
