# Deployment Readiness Report — Web3 Participation Loop

**Prepared:** 2026-09-20
**Scope:** fictional hiring assessment (MUST Company). All data is synthetic and labelled as such.
**Status:** READY — both repositories deployed, both production deployments live and verified.

## 1. Executive Summary

The Web3 participation loop prototype is complete, verified, and live. The codebase passes its full
verification stack (typecheck, 98 tests, production build), the dataset is consistent with the
documented baseline, no credentials or secrets are committed, and exactly one working Vercel
deployment exists per repository.

| Repository | Vercel project | Live alias | Status |
| --- | --- | --- | --- |
| `Flux-web3/Web3-Participation-Loop-COPY` (primary) | `web3-participation-loop-main` | https://web3-participation-loop-main.vercel.app | LIVE — READY, HTTP 200 |
| `Flux-web3/web3-participation-loop` (mirror) | `web3-participation-loop` | https://web3-participation-loop.vercel.app | LIVE — READY, HTTP 200 |

## 2. Verification Performed

All commands were executed from `prototype/` on `main` at commit `f55980c` (final pass) and re-run
clean on the shipped commit.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | Clean — no errors |
| Unit/integration tests | `npm test` (Vitest) | 9 files, 98/98 passing |
| Production build | `npm run build` (`vite build`) | Success — 36 modules |
| Build artifacts | — | `index.html` 1.53 kB, CSS 5.07 kB, JS 49.32 kB (gzip 14.28 kB) |
| Production smoke (primary) | HTTP GET alias | 200 — `MUST Company - Participation Loop Prototype`, bundle served |
| Production smoke (mirror) | HTTP GET alias | 200 — same title/bundle |
| Secrets scan | `git grep` for credential patterns over HEAD | No matches; no `process.env`/`import.meta.env` in tracked source |
| Dataset consistency | Diff `data/synthetic-participants.csv` vs docs baseline | Consistent (20 acquisitions, 119 events, 7 rejection reasons) |
| Dependency audit | `npm audit` | 5 findings — all in dev/build-time dependencies, no runtime exposure, no forced upgrades applied (see §5) |

## 3. Configuration

- **Build:** Vite 5. Full-Stack TS prototype in `prototype/`; package root is `prototype/`.
- **Vercel settings (both projects):** framework `vite`, root directory `prototype`, output directory `dist` (set as project settings — `rootDirectory` is not a valid `vercel.json` key).
- **`vercel.json` (repo root):** `{ "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist" }` — honoured when no project `rootDirectory` override exists.
- **Content hashing:** pure-TS SHA-256 (`prototype/lib/hash.ts`) — byte-identical to `node:crypto` (parity-tested), no Node built-ins in the browser bundle.

## 4. Cleanup Applied Before This Report

- Deleted the duplicate, misconfigured Vercel project `web3-participation-loop-copy` (no framework/root settings → failing deployments and 404 URLs on the primary repo's push history).
- Recreated the deleted `web3-participation-loop` project (mirror repo), configured it identically to the primary project, and deployed the current head successfully.
- Updated the two stale GitHub deployment statuses (one per repo) from `failure` (referencing dead URLs) to `success` against the live aliases.
- Removed the locally downloaded `prototype/.env.local` (runtime Vercel OIDC token; gitignored, not committed).
- Tidied `.gitignore` (removed duplicate trailing entries left by the Vercel CLI).

## 5. Known Items / Accepted Risks (not blockers for this assessment)

- **`npm audit` findings:** 5 vulnerabilities in dev/build-time toolchain (esbuild/vite transitive chain and similar). No production-runtime code path reaches them; no secrets or user input are involved. Forced upgrades would be breaking and are outside the assessment scope. Re-evaluate before any future production hardening.
- **Synthetic-only evidence:** all funnel numbers are seeded simulation data by design (labelled). Nothing represents real user behaviour or real-world performance.
- **Historical GitHub statuses:** GitHub deployment statuses are immutable; older successful records for now-deleted deployments remain in the Environments tab history but the latest status on both repos points at live URLs.
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

- Prototype: https://web3-participation-loop-main.vercel.app
- Dashboard: https://web3-participation-loop-main.vercel.app/#dashboard
- Dataset: https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/data/synthetic-participants.csv
- Source (primary): https://github.com/Flux-web3/Web3-Participation-Loop-COPY
- Source (mirror): https://github.com/Flux-web3/web3-participation-loop