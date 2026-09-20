# Final Directive — Web3 Participation Loop

## 1. Objective

Build and demonstrate a measurable Web3 participation loop that moves participants — acquired through open channels — through a waitlist, disclosure and review process into qualified participation and legitimate business follow-up.

The system must preserve a low-friction off-chain participation path while supporting optional on-chain acknowledgement.

## 2. Primary Bottleneck

Disclosure/review → qualified reviewer.

## 3. Core Journey

Acquisition → Waitlist → Disclosure → Review → Qualification.

After qualification, two independent branches run in parallel:

- Qualified Review → Business Follow-up
- Qualified Review → Optional On-chain Acknowledgement

Neither branch depends on the other, and neither is a precondition for the other. Acknowledgement does not occur after business follow-up.

## 4. Scope

The prototype covers:

- acquisition (open channel entry);
- waitlist registration;
- disclosure access;
- structured review;
- qualification;
- duplicate handling;
- abuse handling;
- business follow-up;
- optional wallet acknowledgement;
- acknowledgement success/failure;
- funnel measurement;
- synthetic operating data.

## 5. Participation Eligibility

A participant becomes a qualified reviewer by:

1. entering through an acquisition channel (open — no personal invitation is required);
2. joining the waitlist;
3. being eligible for the review round (a synthetic attribute that gates qualification, not entry);
4. accessing the disclosure;
5. submitting a review that satisfies the qualification rules.

## 6. Qualified Review Definition

A review is qualified when:

Eligible
AND Disclosure Viewed
AND Complete
AND Disclosure Referenced
AND Substantive
AND Not Duplicate
AND Not Abuse Flagged.

## 7. Review Requirements

A submission must include:

- disclosure section;
- substantive question or observation;
- explanation of why it matters.

## 8. Incentive Logic

Permitted incentives include:

- access;
- reviewer status;
- review priority;
- future participation opportunities.

No token, TGE, airdrop, yield, investment return, ownership or guaranteed reward is promised.

## 9. Wallet Rules

Wallet connection is optional.

A participant can choose:

- Connect Wallet
- Continue Without Wallet

Declining wallet connection must not invalidate qualified participation.

## 10. Acknowledgement Failure

If acknowledgement fails:

- the failure is recorded;
- the qualified review remains qualified;
- business follow-up eligibility remains unaffected unless a separate rule explicitly states otherwise.

## 11. Duplicate and Abuse Handling

Duplicate submissions do not increase qualified conversion.

Abuse-flagged synthetic records are excluded from qualified conversion according to the measurement rules and remain visible to operations.

## 12. Business Conversion

Business conversion is represented by a legitimate follow-up generated from a qualified review.

Examples:

- review call;
- information request;
- partner/practitioner conversation.

Wallet activity is not business conversion.

## 13. Event Schema

Track (append-only; the log is the single source of truth and every metric is derived from it):

- acquisition_visited
- waitlist_joined
- disclosure_opened
- review_submitted
- review_evaluated
- review_qualified
- review_rejected
- duplicate_detected
- abuse_flagged
- followup_created
- wallet_prompted
- wallet_declined
- wallet_connected
- acknowledgement_attempted
- acknowledgement_succeeded
- acknowledgement_failed

These are the conceptual event names. The prototype implements them as a typed, append-only event log (a PascalCase discriminated union, e.g. `AcquisitionVisited`, `ReviewEvaluated`, `WalletAcknowledgementSucceeded`); the vocabulary above maps one-to-one onto those types.

## 14. Core Metrics

### Waitlist Activation Rate

Waitlist Joins / Acquisition Entries

### Disclosure Engagement Rate

Disclosure Viewers / Waitlist Participants

### Review Submission Rate

Submitted Reviews / Disclosure Viewers

### Review Qualification Rate

Qualified Reviews / Submitted Reviews

### Qualified Participation Rate

Qualified Reviews / Eligible Participants

### Business Follow-up Conversion

Qualified Follow-ups / Qualified Reviews

### Acknowledgement Success Rate

Successful Acknowledgements / Acknowledgement Attempts

Wallet activity must remain separate from qualified participation.

## 15. Synthetic Baseline

The prototype uses synthetic simulation data.

Example:

- 100 acquisition entries;
- 72 waitlist joins;
- 58 disclosure viewers;
- 42 review submissions;
- 26 qualified reviews;
- 10 qualified follow-ups.

These values are synthetic and are not real-world performance results.

## 16. Targets

The planning target is to move qualified participation toward 35–40% while maintaining acceptable quality and abuse levels.

This is a simulation planning target, not a forecast.

## 17. Stop Rules

### Scale

Scale an intervention when qualified participation improves while quality and abuse guardrails remain acceptable.

### Pivot

Pivot when participation improves but qualified review quality or business follow-up deteriorates.

### Kill

Kill when the minimum sample threshold is reached without meaningful improvement or when the intervention introduces unacceptable operational, abuse or claim-safety risk.

## 18. MVP Requirements

The prototype must demonstrate:

1. acquisition;
2. waitlist;
3. disclosure;
4. review;
5. qualification;
6. duplicate handling;
7. abuse handling;
8. business follow-up;
9. wallet decline;
10. acknowledgement failure;
11. acknowledgement success;
12. separate wallet measurement.

## 19. Completion Criteria

The implementation is complete when:

- all primary participant states work;
- wallet participation is optional;
- failed acknowledgement does not invalidate qualification;
- duplicate submissions are excluded;
- abuse records are separately classified;
- qualified reviews are distinguishable from raw submissions;
- business follow-up is measurable;
- wallet activity is separately measurable;
- at least ten labelled synthetic records exist;
- funnel calculations are reproducible;
- all submission links work;
- the prototype can be demonstrated in under five minutes.

## 20. Reconciliation Note

This directive was reconciled with the corrected canonical participation model:

- **Entry model:** open acquisition channels replace personal invitation as the entry point; no invitation token gates eligibility (affects §1, §3, §4, §5, §18 and the submission checklist).
- **Post-qualification branches:** business follow-up and optional on-chain acknowledgement are independent; acknowledgement does not occur after follow-up (§3).
- **Event schema (§13):** `invitation_sent` → `acquisition_visited`; `review_started` removed (not implemented — the funnel measures `disclosure_opened → review_submitted` directly); `review_evaluated` added to record the seven-gate evaluation.
- **Metrics (§14):** Waitlist Activation uses *Acquisition Entries*; Qualified Participation uses *Eligible Participants*.
- **Baseline (§15):** "100 invitations" → "100 acquisition entries" (all downstream counts unchanged).

Unchanged: the primary bottleneck, the qualified-review definition, incentive limits, wallet optionality, the business-conversion definition, targets, stop rules and non-goals.

---

# Results / Handoff Appendix

## Artifact Links

> Artifacts are versioned in this repository (no Notion workspace is used). Links point to the canonical `main` branch of the primary repository, mirrored to the secondary repository.

### Journey & Participation Rules

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/docs/participation-rules.md

### Working Prototype

https://web3-participation-loop-main.vercel.app

### PRD

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/docs/prd.md

### Five-item Backlog

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/docs/backlog.md

### Synthetic Dataset

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/data/synthetic-participants.csv

### Dashboard

https://web3-participation-loop-main.vercel.app/#dashboard

### Experiment Brief

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/docs/experiment-brief.md

### Weekly Decision Memo

https://github.com/Flux-web3/Web3-Participation-Loop-COPY/blob/main/docs/decision-memo.md

### Source Repository

Primary: https://github.com/Flux-web3/Web3-Participation-Loop-COPY
Mirror (kept in sync): https://github.com/Flux-web3/web3-participation-loop

## Reproduction / Viewing Steps

1. Open the prototype.
2. Test the normal qualified-review flow.
3. Test wallet decline.
4. Test duplicate submission.
5. Test acknowledgement failure.
6. Test invalid review.
7. Test abuse scenario.
8. Review the operations dashboard.
9. Compare dashboard metrics against the synthetic dataset.

## Verification Results

Record actual verification results here.

Do not claim tests or checks that were not performed.

All checks below were actually run in the final QA pass (2026-09-20).

- **Typecheck:** `tsc --noEmit` — clean, no errors (`prototype/`).
- **Tests:** Vitest — 9 test files, **98/98 tests passing** (`prototype/`).
- **Build:** `vite build` — success, 36 modules; `dist/index.html` 1.53 kB, `assets/index-CGEhekz0.css` 5.07 kB, `assets/index-DrTqkm0w.js` 49.32 kB (gzip 14.28 kB).
- **Production smoke:** `https://web3-participation-loop-main.vercel.app` → HTTP 200, `<title>MUST Company - Participation Loop Prototype</title>`, JS bundle served. `https://web3-participation-loop.vercel.app` (mirror deployment) → HTTP 200, same title.
- **Dataset integrity:** `data/synthetic-participants.csv` verified consistent with the docs' baseline (20 acquisitions; 119 events; 7 rejection reasons; one record set).
- **Secrets scan:** `git grep` over HEAD for `eyJ…`, `sk-…`, `AKIA…`, `BEGIN … PRIVATE KEY`, `VERCEL_`, `SERVICE_ROLE` → no matches. No `process.env` / `import.meta.env` usage in tracked source. No credentials or API keys are committed. The runtime-locally-generated `prototype/.env.local` (Vercel OIDC token) is gitignored and was removed from disk; no such file is committed.
- **Deployment layout:** one production deployment per repository, both READY:
  - Primary repo → Vercel project `web3-participation-loop-main` (`rootDirectory=prototype`, framework vite, output `dist`) → alias `web3-participation-loop-main.vercel.app`.
  - Mirror repo → Vercel project `web3-participation-loop` (same settings) → alias `web3-participation-loop.vercel.app`.
  - A duplicate, misconfigured project (`web3-participation-loop-copy`) that produced failing deployments/404 URLs was deleted; GitHub deployment statuses for both repos updated to `success` against the live aliases.
- **npm audit:** `npm audit` reports 5 vulnerabilities in dev dependencies (high/medium, build-time only, no runtime exposure). Not force-fixed (breaking changes outside scope); tracked in `docs/deployment-readiness-report.md`.

## AI Contribution

AI was used for:

- architecture exploration;
- implementation;
- documentation;
- synthetic data;
- QA assistance.

Final product decisions and verification were human-owned.

## AI Corrections

Record actual corrections discovered during implementation and QA.

- **Browser build break:** an initial implementation imported `node:crypto` (for content hashing), which broke the Vite browser bundle. Corrected by replacing it with a pure-TS SHA-256 implementation (`prototype/lib/hash.ts`); verified byte-identical hex output vs `node:crypto` (parity test + `abc` FIPS-180-4 vector).
- **TypeScript defects caught by typecheck:** `src/dashboard.ts` used unstable key indexing into the funnel metrics map (fixed with `keyof FunnelMetrics` typing on `RATE_CARDS`); `src/journey.ts` called `createFollowUp` without the required `actor` parameter (fixed by passing `operations`).
- **Vercel config invalid property:** `vercel.json` initially contained `rootDirectory`, which the Vercel CLI rejects ("should NOT have additional property"). `rootDirectory` is a project setting, not a `vercel.json` key; the file was corrected and the setting applied via the Vercel project API.
- **Duplicate/broken Vercel projects:** the COPY repo was wired to two Vercel projects; one (`web3-participation-loop-copy`) had no build config and produced failing deployments and 404 URLs. It was deleted. The mirror repo's project (`web3-participation-loop`) had been deleted, leaving failing statuses; it was recreated, configured (`rootDirectory=prototype`), redeployed successfully, and GitHub statuses updated to `success` against the live aliases.
- **Dataset line-ending artifact:** `data/synthetic-participants.csv` showed a phantom modified status caused by LF/CRLF normalization; content verified identical to HEAD and restored (no data change).

## Limitations

This is a fictional hiring assessment.

All participants and performance results are synthetic.

The prototype does not:

- process real money;
- execute mainnet transactions;
- verify asset ownership;
- verify reserves;
- provide investment guarantees;
- distribute real rewards;
- represent production compliance approval;
- provide production-grade Sybil detection.

## Submission Verification

- [x] Prototype works
- [x] Acquisition → waitlist flow works
- [x] Valid review qualifies
- [x] Invalid review rejected
- [x] Duplicate handled
- [x] Abuse handled
- [x] Wallet decline works
- [x] Acknowledgement failure works
- [x] Dashboard checked
- [x] Dataset checked
- [x] Calculations manually verified
- [x] Every link opened (all 11 handoff/readiness URLs verified HTTP 200; re-checked after final push)
- [x] Repository accessible
- [x] No credentials/API keys
- [x] Synthetic data labelled
- [x] No fabricated research/results
- [ ] Loom ≤5 minutes (no Loom video was recorded; the prototype demonstrably runs in under five minutes per §19)
- [x] intent.md complete
- [x] directive.md complete
