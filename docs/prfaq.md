# PRFAQ — Lift5 (working name)

## Press Release

**FOR IMMEDIATE RELEASE**

### A mobile-friendly, zero-idle-cost web app brings the StrongLifts 5x5 method to your own domain

Today marks the launch of Lift5, a self-hosted, mobile-friendly strength-training tracker built around the StrongLifts 5x5 method. Lift5 runs the classic linear-progression barbell program — alternating Workout A and Workout B, three days a week — and automates the parts that are tedious to do by hand: which workout is next, how much weight to load, how to deload after a stall, and what plates to put on the bar.

Lifters who've used StrongLifts 5x5's official app have run into the same wall: the app that used to be free now sits behind a recurring subscription, and core features like the warm-up calculator are paywalled. Lift5 exists because the underlying program is simple and well-documented — it doesn't need a subscription. It needs a fast, ad-free, mobile web app that remembers who you are and gets out of your way between sets.

Lift5 is built to run at effectively zero cost when nobody is training. The frontend is a Next.js app hosted on AWS Amplify; the database is DynamoDB, which has no idle compute or storage floor to pay for; authentication is handled by a managed identity provider so a single login persists across sessions via a secure cookie — no re-entering a password before every workout.

"I wanted the app I used ten years ago — enter your bodyweight, hit start, and it tells you what to lift," said the project's creator and first user. "I don't want a subscription, I don't want a coach chatbot, and I don't want to pay for a server that sits idle five days a week while I'm not at the gym."

Lift5 is multi-user by design — each account's data is fully isolated — but is expected to have exactly one active user at launch: its creator. The architecture supports adding family or friends later without any rework.

To get started, a user signs in once; a long-lived session cookie keeps them logged in on their phone. From there, Lift5 shows today's workout, tracks each set as it's completed, calculates warm-up sets and plate loading automatically, and applies StrongLifts' standard progression and deload rules after every session.

---

## FAQ

### Customer-facing

**Q: What is Lift5?**
A mobile-friendly web app that runs the StrongLifts 5x5 barbell strength program: automated A/B workout scheduling, weight progression, deloads, a warm-up calculator, a plate calculator, a rest timer, and workout history with progress charts.

**Q: Do I need to create an account every time?**
No. You log in once; a secure, long-lived cookie keeps you signed in on that device until you explicitly log out or the session expires (default 90 days).

**Q: Is this a copy of the StrongLifts app?**
No — it implements the same public, well-documented training method (5 sets of 5 reps, A/B alternation, linear progression, 10% deload after three stalls). It is an independent tool built for personal use, not a redistribution of StrongLifts' app, brand, or content.

**Q: Can more than one person use it?**
Yes. Each user has an isolated account and workout history. The app is expected to have one primary user at launch, with the option to invite others later.

**Q: What does it cost to run?**
The target is near-zero cost when idle — low-traffic/serverless hosting, DynamoDB's on-demand billing (no minimum capacity, no idle floor), and a free-tier identity provider. Realistically close to $0/month in idle weeks — see the PRD's "Cost model" section for the full breakdown.

**Q: Does it work on my phone?**
Yes — it's a responsive, mobile-first web app. It can be added to your phone's home screen and used like a native app (PWA), including in a gym with spotty signal for cached views.

**Q: What programs does it support?**
Launch scope is the classic StrongLifts 5x5 program only (Squat/Bench/Row and Squat/OHP/Deadlift). Other programs (Madcow, 5/3/1, custom routines) are out of scope for v1.

**Q: Is my data private?**
Yes. Each account's workout data is isolated at the database layer and only accessible to that authenticated user.

### Internal / stakeholder

**Q: Why Next.js + Amplify + DynamoDB instead of a simpler stack (e.g., a static site + spreadsheet, or Firebase)?**
The user wants an AWS-native stack for its cost profile and as a chance to build real experience with it. Aurora Serverless v2 (PostgreSQL) was the original default, but a schema spike (`spikes/dynamodb-schema/`) confirmed DynamoDB serves every v1 access pattern with zero secondary indexes, at a genuinely lower idle cost — no storage floor, no cold-start ACU ramp-up. See `prd.md` §7 for the full comparison.

**Q: Why not just use the real StrongLifts app?**
It moved to a subscription model and paywalls core features (warm-up calculator, custom routines, history). This project trades a few days of build time for $0/month recurring cost and full control of the data.

**Q: What's explicitly out of scope for v1?**
Payments/subscriptions, social/sharing features, coaching content, nutrition tracking, native mobile apps, alternative programs, Apple Watch/wearable integration, offline-first full sync (only basic PWA caching).

**Q: What's the biggest risk?**
A single-table DynamoDB design is less flexible than SQL if an unanticipated query pattern shows up later. This is mitigated by having enumerated and spiked every v1 access pattern up front rather than guessing — see `docs/spikes.md`.
