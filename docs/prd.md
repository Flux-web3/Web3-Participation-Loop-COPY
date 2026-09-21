# Product Requirements Document — Web3 Participation Loop

**Status:** Draft for fictional hiring assessment  
**Context:** This PRD describes a **fictional** Web3 participation loop for "MUST Company". It is a hiring-assessment artifact only. All participants, datasets and performance results are **synthetic**. The system does not process real money, issue real rewards, promise tokens/TGE/airdrop/yield, connect real wallets, sign mainnet transactions, or provide production compliance approval. No value in this document is presented as real-world evidence.  
**Source of truth:** `intent.md`, `directive.md`, and the prototype implementation (`prototype/package.json`).

---

## 1. Overview & Problem

The platform acquires participants through open acquisition channels, moves them through a waitlist into a disclosure and review journey, and — for qualified reviews — creates legitimate business follow-up and an optional on-chain acknowledgement.

The valuable business outcome is **meaningful participation**: a review that is useful and can drive a legitimate follow-up. Raw signups, disclosure views, wallet connections and raw review submissions are not valuable in themselves.

Four candidate bottlenecks were evaluated on a 1–5 scale using `Value × Conversion × Confidence ÷ Effort`:

| Bottleneck | Score |
| --- | ---: |
| Acquisition → Waitlist | 9 |
| Waitlist → Disclosure | 8 |
| Disclosure/Review → Qualified Reviewer | **25** (5 × 5 × 4 ÷ 4) |
| Qualified Review → Follow-up | 20 |

The selected primary bottleneck is **Disclosure/Review → Qualified Reviewer**. A raw submission is not necessarily useful participation: it may be incomplete, generic, unrelated to the disclosure, duplicated, abusive, or produced by synthetic bot participants. The loop therefore inserts an explicit qualification layer between raw participation and business conversion.

## 2. Goals

- Move participants from acquisition through waitlist, disclosure, review and qualification to legitimate business follow-up.
- Preserve a low-friction, wallet-optional off-chain participation path.
- Define and implement explicit qualification rules so qualified reviews are distinguishable from raw submissions.
- Detect and exclude duplicate submissions; separately classify abuse-flagged records while keeping them visible to operations.
- Keep business follow-up independent from optional on-chain acknowledgement; neither branch is a precondition for the other.
- Measure the seven core funnel rates from a single, append-only event log.
- Demonstrate the full loop in a working prototype in under five minutes using synthetic, labelled data.

## 3. Non-Goals

This product does not attempt to:

- process real money or issue real rewards;
- conduct a token sale or promise TGE allocation, airdrop, yield, investment return, or guaranteed reward;
- verify asset ownership or reserves;
- deploy production smart contracts or execute mainnet transactions;
- make wallet connection a requirement for participation;
- treat wallet activity as business conversion;
- build production-grade Sybil detection;
- conduct live user research, run a live campaign, or collect real customer data.

## 4. Users & Personas

| Persona | Definition |
| --- | --- |
| **Acquired Participant** | A person who arrives through an acquisition channel and may join the review waitlist. Channel is attribution only and never determines eligibility. |
| **Waitlisted Participant** | An acquired person who has registered for the review opportunity. |
| **Reviewer** | A waitlisted participant who enters the disclosure/review flow. |
| **Qualified Reviewer** | A reviewer whose submission satisfies all qualification gates. |
| **Business / Partner User** | A user who acts on qualified reviews through legitimate follow-up (review call, information request, partner/practitioner conversation). |
| **Operations User** | An internal operator responsible for reviewing submissions, handling exception and abuse classifications, and monitoring funnel performance. |

## 5. Scope

In scope: acquisition (open channel entry), waitlist registration, disclosure access, structured review, qualification (seven gates), duplicate handling, abuse handling, business follow-up, optional wallet acknowledgement (prompt/decline/connect), acknowledgement success/failure, funnel measurement, and synthetic operating data. Out of scope: every item in Section 3.

## 6. Core Journey & Post-Qualification Branches

Core journey (must always complete in order):

```
Acquisition → Waitlist → Disclosure → Review → Qualification
```

After qualification, two **independent** branches run in parallel:

```
Qualified Review → Business Follow-up
Qualified Review → Optional On-chain Acknowledgement
```

Constraints:

- Neither branch depends on the other. Acknowledgement does **not** occur after business follow-up.
- Wallet connection is optional at every step; declining must not invalidate qualified participation.
- Acknowledgement failure keeps the review qualified and does not affect business follow-up eligibility.

## 7. Functional Requirements

### 7.1 Acquisition

- Entry is open: participants may enter through any of the open acquisition channels — **direct, referral, campaign, community, partner, social, other**.
- No personal invitation is required. The channel is recorded for **attribution only** and never gates eligibility.
- Entering acquisition emits an `acquisition_visited` event.

### 7.2 Waitlist

- An acquired participant may register for the review opportunity by joining the waitlist.
- Joining emits a `waitlist_joined` event.

### 7.3 Disclosure

- A waitlisted participant may access the project disclosure.
- Access emits a `disclosure_opened` event and grounds the review in a specific disclosure version.
- Reviews referencing a mismatched disclosure version are rejected (see rejection reasons).

### 7.4 Review Submission

- A reviewer submits a structured review containing all three required parts:
  1. disclosure section;
  2. substantive question or observation;
  3. explanation of why it matters.
- Submission emits a `review_submitted` event.

### 7.5 Qualification Engine (seven gates)

A review is qualified when **all** of the following hold:

```
Eligible
AND Disclosure Viewed
AND Complete
AND Disclosure Referenced
AND Substantive
AND Not Duplicate
AND Not Abuse Flagged
```

- Evaluation emits a `review_evaluated` event and then exactly one of `review_qualified` or `review_rejected`.
- Rejection reasons (closed set): `ineligible`, `non_substantive`, `disclosure_version_mismatch`, `incomplete`, `no_section_reference`.
- Duplicate submissions do not increase qualified conversion.

### 7.6 Duplicate Handling — First-Writer-Wins by Content Hash

- Submissions are content-hashed deterministically.
- The **first writer wins**: the earliest submission for a given content hash is retained for potential qualification; later identical content is classified as a duplicate (`duplicate_detected`) and excluded from qualified conversion.
- Content hashing must be deterministic so the same input always produces the same hash (see Non-Functional Expectations).

### 7.7 Abuse Classification

- Records meeting abuse or bot-profile criteria are flagged (`abuse_flagged`) and excluded from qualified conversion per the measurement rules.
- Abuse-flagged synthetic records remain visible to operations; they are separately classified, not deleted.

### 7.8 Business Follow-up

- Business conversion is represented by a legitimate follow-up generated from a **qualified** review: a review call, an information request, or a partner/practitioner conversation.
- Creating a follow-up emits a `followup_created` event.
- Wallet activity is **not** business conversion.

### 7.9 Optional Wallet & Acknowledgement

- The reviewer is prompted (`wallet_prompted`) and may choose:
  - **Connect Wallet** (`wallet_connected`), or
  - **Continue Without Wallet** (`wallet_declined`).
- Declining wallet connection must **not** invalidate qualified participation, and wallet activity is measured separately from qualified participation and is not business conversion.
- When a wallet path is attempted, the system records an acknowledgement attempt (`acknowledgement_attempted`) followed by either `acknowledgement_succeeded` or `acknowledgement_failed`.
- On acknowledgement failure: the failure is recorded, the qualified review **remains qualified**, and business follow-up eligibility is unaffected.

### 7.10 Funnel Metrics

- All seven core rates are computed from the event log (see Section 10).
- Funnel metrics must be reproducible from the synthetic dataset and must never be presented as real results.

### 7.11 Admin Dashboard

- The operations dashboard (route `#dashboard`) displays the current funnel state, per-stage counts, the seven core rates, rejections by reason, duplicate and abuse classifications, and the relationship between qualified reviews, follow-ups, and wallet activity.
- The dashboard distinguishes raw submission counts from qualified review counts.
- The demo journey is available at route `#journey` with the six demo scenarios (A–F); see Section 12.

## 8. Participation Rules Summary

- Entry is via open acquisition channels; the channel is attribution only.
- Qualification requires all seven gates (Section 7.5).
- Reviews must contain the disclosure section, a substantive question/observation, and why-it-matters.
- Wallet connection is optional; declining never invalidates qualification.
- Wallet activity is separate from qualified participation and is not business conversion.
- Acknowledgement failure does not invalidate the review and does not affect follow-up eligibility.
- Duplicate submissions are excluded (first writer wins by content hash); abuse-flagged records are separately classified.
- Business conversion is a legitimate follow-up from a qualified review.
- Incentives are limited to: access, reviewer status, review priority, and future participation opportunities.

## 9. Incentive Limits

Permitted incentives:

- access;
- reviewer status;
- review priority;
- future participation opportunities.

No token, TGE, airdrop, yield, investment return, ownership, or guaranteed reward is promised. The prototype offers none of these and must not imply them.

## 10. Metrics & Measurement

All rates use the exact directive terminology and are derived from the append-only event log.

| Metric | Formula | Verified synthetic baseline |
| --- | --- | ---: |
| Waitlist Activation Rate | Waitlist Joins / Acquisition Entries | 18 / 20 = **0.90** |
| Disclosure Engagement Rate | Disclosure Viewers / Waitlist Participants | 16 / 18 |
| Review Submission Rate | Submitted Reviews / Disclosure Viewers | 14 / 16 |
| Review Qualification Rate | Qualified Reviews / Submitted Reviews | 7 / 14 |
| Qualified Participation Rate | Qualified Reviews / Eligible Participants | 7 / 19 ≈ **0.37** |
| Business Follow-up Conversion | Qualified Follow-ups / Qualified Reviews | 3 / 7 |
| Acknowledgement Success Rate | Successful Acknowledgements / Acknowledgement Attempts | 2 / 4 |

Verified synthetic baseline (seed) totals: acquisitions 20, waitlist joins 18, disclosure viewers 16, submissions 14, qualified 7, eligible 19, follow-ups 3, acknowledgement attempts 4 with 2 successes, and 119 events in total. All values are synthetic and labelled; they are never presented as real results.

Simulation planning target: move qualified participation toward **35–40%** while maintaining acceptable quality and abuse levels. This is a simulation planning target, not a forecast.

## 11. Event-Driven Architecture Note

- The event log is **append-only** and the single source of truth; every metric is derived from it.
- Events are implemented as a typed, PascalCase discriminated union (e.g. `AcquisitionVisited`, `ReviewEvaluated`, `WalletAcknowledgementSucceeded`) that maps one-to-one onto the canonical event vocabulary: `acquisition_visited`, `waitlist_joined`, `disclosure_opened`, `review_submitted`, `review_evaluated`, `review_qualified`, `review_rejected`, `duplicate_detected`, `abuse_flagged`, `followup_created`, `wallet_prompted`, `wallet_declined`, `wallet_connected`, `acknowledgement_attempted`, `acknowledgement_succeeded`, `acknowledgement_failed`.
- Code is separated by responsibility: **domain** (rules: qualification gates, incentives, wallet rules), **commands** (journey actions that append events), **analytics** (funnel derivation from the log), and **seed** (synthetic dataset generation) as distinct layers.
- The prototype stack is Vite + TypeScript (vanilla) with Vitest for tests and `tsc --noEmit` for type checking.

## 12. Integrity & Abuse Controls

- Duplicate handling: deterministic content hashing with first-writer-wins exclusion.
- Abuse handling: synthetic bot/abuse profiles are flagged (`abuse_flagged`), excluded from qualified conversion, yet kept visible to operations.
- Rejection granularity: failed reviews record an explicit reason so operations can distinguish `ineligible`, `non_substantive`, `disclosure_version_mismatch`, `incomplete`, and `no_section_reference`.
- Funnel and baseline figures are synthetic and labelled; no fabricated research or results are presented.
- Dashboard and dataset are cross-checked against the seed (119 events) so calculations are reproducible.

Prototype demo scenarios (route `#journey`):

| Scenario | Description | Expected outcome |
| --- | --- | --- |
| A | Normal qualified review | Qualified; follow-up eligible; acknowledgement optional |
| B | Wallet declined | Qualifies without a wallet; acknowledgement not required |
| C | Duplicate — verbatim copy of U007 | Classified duplicate; excluded from qualified conversion |
| D | Acknowledgement failed | Review stays qualified; follow-up eligibility unchanged |
| E | Invalid / boilerplate review | Rejected with a specific rejection reason |
| F | Abuse / bot profile | Abuse-flagged; excluded from qualified conversion; visible to operations |

## 13. Non-Functional Expectations

- **Reproducibility:** the synthetic seed must regenerate the verified baseline exactly (20 / 18 / 16 / 14 / 7 / 19 / 3 / 4-with-2-successes, 119 events) and produce identical funnel rates across runs and across dashboard and dataset.
- **Deterministic content hashing:** identical submission content must always produce the identical content hash so duplicate detection is stable.
- **Demonstration:** the full loop — all six demo scenarios plus dashboard review — must be demonstrable in **under five minutes**.
- **Type safety:** the prototype type-checks cleanly (`npm run typecheck`) and tests pass (`npm run test`).
- **No credentials:** the repository and deployment contain no API keys, tokens, or secrets.
- **Labelling:** all synthetic data is visibly labelled as synthetic; no real-world claims are made.
- **Links:** all prototype links work; the deployed prototype is available at https://web3-participation-loop.vercel.app (journey at `#journey`, dashboard at `#dashboard`).

## 14. Acceptance Criteria

Mapped directly to the directive's completion criteria:

| # | Directive completion criterion | PRD acceptance criterion |
| --- | --- | --- |
| 1 | All primary participant states work | Acquisition → waitlist → disclosure → review → qualified / rejected states all reachable and correct in the prototype |
| 2 | Wallet participation is optional | Scenario B (wallet declined) qualifies without a wallet; wallet prompt can be declined at any point without invalidating participation |
| 3 | Failed acknowledgement does not invalidate qualification | Scenario D: review remains qualified after acknowledgement failure |
| 4 | Duplicate submissions are excluded | Scenario C (verbatim copy of U007) is classified duplicate and excluded from qualified conversion |
| 5 | Abuse records are separately classified | Scenario F is abuse-flagged, excluded from conversion, and visible to operations |
| 6 | Qualified reviews are distinguishable from raw submissions | Dashboard and event log distinguish `review_qualified`/`review_rejected` from `review_submitted`; submission count (14) differs from qualified count (7) |
| 7 | Business follow-up is measurable | Follow-up conversion computed (3 / 7) and surfaced on the dashboard |
| 8 | Wallet activity is separately measurable | Wallet events counted separately; acknowledgement success rate computed (2 / 4) |
| 9 | At least ten labelled synthetic records exist | Seed contains 119 labelled synthetic events covering all scenarios and states |
| 10 | Funnel calculations are reproducible | Dashboard rates match hand-verified seed values exactly, across repeated runs |
| 11 | All submission links work | Journey, dashboard, and scenario links function in the deployed prototype |
| 12 | The prototype can be demonstrated in under five minutes | Walkthrough of Scenarios A–F plus dashboard fits within five minutes |

## 15. Open Questions / Future Work

- Whether qualification should move from a deterministic rules engine to human or hybrid review at scale, and how review latency would be handled.
- Whether the `eligible` gate should eventually be driven by real (non-synthetic) attributes and how that interacts with open channel entry.
- Production-grade Sybil/resilience detection beyond the synthetic bot-profile flag.
- Real wallet-connection flows (actual provider integration) and non-prototype acknowledgement mechanics.
- Expanding the acquisition channel taxonomy and per-channel funnel attribution while preserving the rule that channels never gate eligibility.
- Continuous iteration policy: apply the directive's scale / pivot / kill stop rules once the synthetic baseline is replaced by any real pilot data.
- Backlog sizing of the seven funnel improvements into the five-item backlog artifact.