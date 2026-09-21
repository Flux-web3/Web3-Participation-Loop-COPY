# Web3 Participation Loop

A fictional, synthetic-only product prototype built for the MUST Company **Web3 Participation Loop**
Product-Owner assessment. It models a measurable participation funnel — from open-channel
**acquisition** through **waitlist**, **disclosure**, **review** and **qualification**, into
**business follow-up** and an **optional on-chain acknowledgement** — with every metric derived from
a typed, append-only event log.

> ⚠️ **Synthetic assessment artifact.** All participants, reviews, funnel numbers and outcomes are
> synthetic and labelled as such. Nothing here processes real money, issues real rewards or tokens,
> runs mainnet transactions, verifies asset ownership or reserves, or represents production
> compliance. See [`intent.md`](intent.md) and [`directive.md`](directive.md).

## Live

- **Prototype:** https://web3-participation-loop.vercel.app
- **Operations dashboard:** https://web3-participation-loop.vercel.app/#dashboard

## The loop

```
Acquisition → Waitlist → Disclosure → Review → Qualification
                                                   ├── Business follow-up                 (independent)
                                                   └── Optional on-chain acknowledgement  (independent)
```

- **No personal invitation is required** — acquisition channels (direct, referral, campaign,
  community, partner, social, other) are recorded for attribution only and never gate eligibility.
- A review is **qualified** only when all seven gates pass: Eligible, Disclosure Viewed, Complete,
  Disclosure Referenced, Substantive, Not Duplicate, Not Abuse-flagged.
- **Wallet connection is optional.** Declining it, or a failed acknowledgement, never invalidates a
  qualified review. Wallet activity is measured separately and is **not** a business conversion.

## Architecture

A small event-sourcing-lite TypeScript app (Vite). An append-only typed event log is the single
source of truth, and every funnel metric is derived from it.

- `prototype/domain/` — pure domain logic (events, qualification gates, metrics)
- `prototype/commands/` — command handlers that append events
- `prototype/lib/` — utilities (pure-TS SHA-256 for duplicate detection)
- `prototype/src/` — UI: hash-routed prototype flow + operations dashboard
- `prototype/test/` — Vitest suites (124 tests)
- `data/synthetic-participants.csv` — labelled synthetic dataset

## Run locally

```bash
cd prototype
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run — 124 tests
npm run dev         # local dev server
npm run build       # production build → dist/
npm run preview     # serve the production build
```

## Documentation

| Document | Purpose |
| --- | --- |
| [intent.md](intent.md) | Why this bottleneck; prioritisation |
| [directive.md](directive.md) | Canonical product & measurement spec |
| [docs/prd.md](docs/prd.md) | Product requirements |
| [docs/participation-rules.md](docs/participation-rules.md) | Qualification, duplicate & abuse rules |
| [docs/experiment-brief.md](docs/experiment-brief.md) | Experiment design & metrics |
| [docs/decision-memo.md](docs/decision-memo.md) | Weekly decision memo |
| [docs/backlog.md](docs/backlog.md) | Five-item next-iteration backlog |
| [docs/deployment-readiness-report.md](docs/deployment-readiness-report.md) | Verification & deployment status |

## Demo

A narrated, ≤5-minute walkthrough of the six scenarios and the operations dashboard is being
produced separately, outside this repository; no Loom or other hosted recording exists or is
claimed. The live prototype and dashboard links above let the six scenarios and metrics be
verified directly. All data shown is synthetic.
