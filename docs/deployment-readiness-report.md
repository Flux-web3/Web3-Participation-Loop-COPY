# Deployment Readiness Report — Web3 Participation Loop

**Prepared:** 2026-09-21
**Scope:** fictional hiring assessment (MUST Company). All data is synthetic and labelled as such.
**Status:** READY — repository deployed, production deployment live and verified.

## 1. Executive Summary

The Web3 participation loop prototype is complete, verified, and live. The codebase passes its full
verification stack (typecheck, 103 tests, production build), the dataset is consistent with the
documented baseline, no credentials or secrets are committed, and one working Vercel deployment is
live and serving the current build.

| Repository | Vercel project | Live alias | Status |
| --- | --- | --- | --- |
| `Flux-web3/web3-participation-loop` | `web3-participation-loop` | https://web3-participation-loop.vercel.app | LIVE — READY, HTTP 200 |

**Recent fix (2026-09-21, commit `ba49f35`):** the live journey previously let a review be
submitted against disclosure v2 while the participant's recorded view was v1 (the "read the
previous version" toggle existed only on the view step), producing a spurious version-mismatch
rejection. The review now carries the version from the participant's latest disclosure-view event,
with a stale-view warning and a re-read action; two regression tests were added (103/103 passing).
A `.gitattributes` entry was also added pinning `data/*.csv` to LF, eliminating a phantom
CRLF-modified status on Windows checkouts.

## 2. Verification Performed

All commands were executed from `prototype/` on `main` at the shipped commit.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | Clean — no errors |
| Unit/integration tests | `npm test` (Vitest) | 11 files, 103/103 passing |
| Production build | `npm run build` (`vite build`) | Success |
| Build artifacts | — | `index.html` 1.59 kB, `assets/index-CNAEBgJ3.css` 5.78 kB, `assets/index-Vh6GkHar.js` 51.67 kB (gzip 15.06 kB) |
| Production smoke | HTTP GET `https://web3-participation-loop.vercel.app` | 200 — `MUST Company - Participation Loop Prototype`, bundle `assets/index-Vh6GkHar.js` served |
| Deployed == source | Compare live bundle vs local build | Match — live serves `index-Vh6GkHar.js`, identical to the current build |
| Secrets scan | `git grep` for credential patterns over HEAD | No matches; no `process.env`/`import.meta.env` in tracked source |
| Dataset consistency | Inspect `data/synthetic-participants.csv` | 20 labelled synthetic participant records; runtime event log/funnel validated by the `seed` test suite |
| Dependency audit | `npm audit` | Findings confined to dev/build-time dependencies, no runtime exposure (see §5) |

## 3. Configuration

- **Build:** Vite 5. TypeScript prototype in `prototype/`; package root is `prototype/`.
- **Vercel project (`web3-participation-loop`):** framework `vite`, root directory `prototype`, output directory `dist` (set as project settings — `rootDirectory` is not a valid `vercel.json` key).
- **`vercel.json` (repo root):** `{ "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist" }` — honoured together with the project root-directory setting.
- **Content hashing:** pure-TS SHA-256 (`prototype/lib/hash.ts`) — byte-identical to `node:crypto` (parity-tested), no Node built-ins in the browser bundle.

## 4. Deployment

- The repository deploys to a single Vercel project (`web3-participation-loop`) with root directory `prototype`, framework `vite`, output `dist`.
- The production alias `https://web3-participation-loop.vercel.app` returns HTTP 200 and serves the current build (`assets/index-Vh6GkHar.js`), confirming the deployed site matches the shipped commit.
- No `.env` / `.env.local` or credential files are committed; any locally-generated Vercel OIDC token file is gitignored.

## 5. Known Items / Accepted Risks (not blockers for this assessment)

- **`npm audit` findings:** vulnerabilities confined to the dev/build-time toolchain (esbuild/vite transitive chain). No production-runtime code path reaches them; no secrets or user input are involved. Forced upgrades would be breaking and are outside the assessment scope. Re-evaluate before any future production hardening.
- **Synthetic-only evidence:** all funnel numbers are seeded simulation data by design (labelled). Nothing represents real user behaviour or real-world performance.
- **No production-grade Sybil detection:** abuse classification is a labelled synthetic heuristic, explicitly not a defence (see directive §11 and participation rules).

## 6. Reviewer Reproduction

```powershell
cd prototype
npm install
npm run typecheck
npm test
npm run build
npm run preview   # serves dist locally
```

Live links:

- Prototype: https://web3-participation-loop.vercel.app
- Dashboard: https://web3-participation-loop.vercel.app/#dashboard
- Dataset: https://github.com/Flux-web3/web3-participation-loop/blob/main/data/synthetic-participants.csv
- Source: https://github.com/Flux-web3/web3-participation-loop
