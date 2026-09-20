# Five-item Backlog — Next Iteration

## Context / Scope

This backlog defines the next iteration for the Web3 participation loop prototype
(working prototype: https://web3-participation-loop-main.vercel.app). The primary
bottleneck remains **disclosure/review → qualified reviewer**, with a planning target of
moving **qualified participation toward 35–40%** while keeping quality and abuse guardrails
acceptable (a simulation target, not a forecast).

The verified synthetic baseline is already informative: acquisitions 20, waitlist joins 18,
disclosure viewers 16, submissions 14, qualified 7, eligible 19, follow-ups 3, acknowledgement
attempts 4 / successes 2; rates 0.90, 16/18, 14/16, 7/14, 7/19 ≈ 0.37, 3/7, 2/4; 119 labelled
synthetic events. Two observations drive this backlog:

1. The early funnel is near-saturated (disclosure engagement 16/18, submission 14/16). The
   actionable lever inside the selected bottleneck is the **qualification step itself**, and
   the protection of that step against quality/integrity erosion — not a brute-force push on
   acquisition or disclosure entry.
2. Baseline qualified participation (≈0.37) already sits at the low edge of the target band.
   The next iteration is therefore about **measuring durable improvement with evidence**,
   **calibrating the quality guardrails that define qualification**, and **hardening the two
   post-qualification branches** — so the stop rules (Scale / Pivot / Kill) can be applied
   with confidence rather than by feel.

Scope note: the items below extend the MVP, which implements acquisition, waitlist, disclosure,
review, qualification, duplicate handling (content-hash first-writer-wins), abuse handling,
business follow-up, wallet decline, acknowledgement success/failure, separate wallet
measurement, an operations dashboard, and a reproducible synthetic dataset — all marked "MVP
done" where referenced. Nothing in this backlog processes real money, runs a live campaign,
deploys production smart contracts, or creates production-grade Sybil detection (non-goals,
intent.md §9).

## Prioritization Summary

| ID | Priority | Item | Primary metrics affected | Stop-rule tie | Effort |
| -- | -------- | ---- | ------------------------ | ------------- | ------ |
| B-01 | P0 | Experiment harness for disclosure-framing interventions | Disclosure Engagement, Review Submission, Review Qualification, Qualified Participation | Scale / Pivot / Kill | L |
| B-02 | P1 | Substantive-quality gate calibration | Review Qualification, Qualified Participation, rejection-reason mix | Pivot (quality guardrail) | M |
| B-03 | P2 | Business follow-up velocity and timeliness tracking | Business Follow-up Conversion | Pivot (conversion health) | S |
| B-04 | P3 | Duplicate and abuse detection hardening | Review Qualification, integrity counters | Kill (integrity guardrail) | L |
| B-05 | P4 | Acknowledgement reliability and retry reporting | Acknowledgement Success | Kill (participant-experience risk) | M |

B-01 is the measurement/observability item of the set: it is deliberately P0 because the stop
rules cannot be applied rigorously without a repeatable, deterministic way to compare
interventions against the baseline.

---

## B-01 — Experiment Harness for Disclosure-Framing Interventions

**Priority:** P0 — **Effort:** L

**Problem statement (why now).** The selected bottleneck is disclosure/review → qualified
reviewer, yet the current architecture offers no controlled way to test an intervention and
decide Scale / Pivot / Kill. Without a repeatable harness, any disclosure-framing change
(e.g., how the disclosure is presented, which sections are emphasized, disclosure version
release) risks being adopted on intuition rather than measured funnel impact — exactly the
failure mode the stop rules exist to prevent. This is a measurement gap, not a features gap.

**Proposed change.** Build a deterministic experiment harness on top of the existing typed,
append-only event log (MVP done) and the seeded synthetic dataset:

- A variant is a named, versioned configuration bundle (intervention parameters + optional
  seed deltas) executed against the reproducible synthetic dataset.
- Each run executes in isolation, emits a side-by-side report of all seven funnel metrics,
  the rejection-reason mix, and integrity counters, and produces an explicit
  scale / pivot / kill recommendation per the directive's stop rules.
- Ship a pilot disclosure-framing variant (e.g., disclosure emphasis/section-order framing)
  that exercises the harness end-to-end and produces a measured delta versus baseline.
- Variant runs never mutate the canonical log; results are derived read-side from the same
  pure analytics used by the dashboard (MVP done).

**Measurable acceptance criteria.**

- The harness runs at least three distinct variants plus baseline over the deterministic seed
  and reproduces identical outputs for identical inputs (determinism test).
- The comparison report covers all seven metric rates plus rejection-reason mix and
  duplicate/abuse counters, and classifies each variant as scale / pivot / kill.
- The pilot framing variant yields a measured, non-zero delta on disclosure engagement or
  qualified participation versus baseline, with the decision recommendation recorded.
- New tests added (≥ 8), existing 98 unit tests stay green, strict typecheck passes.

**Affected metrics.** Disclosure Engagement, Review Submission, Review Qualification, Qualified
Participation; integrity counters as guardrail context.

---

## B-02 — Substantive-Quality Gate Calibration

**Priority:** P1 — **Effort:** M

**Problem statement (why now).** Of the seven qualification gates, the substantive gate is the
only content-judgment gate and the one most likely to trade participation against quality.
Review qualification is 7/14 (0.5) and `non_substantive` is an active rejection reason in the
baseline. Reaching and holding the 35–40% qualified-participation target durably requires the
substantive threshold profile to be chosen with evidence, and the Pivot rule explicitly demands
that we detect when participation improves while review quality deteriorates. The thresholds
are already parameterized and injectable (MVP done); the missing piece is a calibration
procedure and quality-side reporting.

**Proposed change.**

- Add a calibration grid that runs the labelled synthetic review corpus across a spread of
  substantive threshold profiles (`minWordCount`, `minQuestionWords`, `minUniqueWords`,
  `minContentWords`) and reports, per profile: review qualification rate, qualified
  participation, weak-pass count (content that only barely clears), and boilerplate recall.
- Surface a quality-side readout — e.g., tier z-shares of qualified reviews against stricter
  threshold tiers and the rejection-reason mix — so quality erosion is observable before it
  becomes a Pivot trigger.
- Produce a recommended threshold profile for the harness (B-01) to test; keep the current
  defaults until a variant selects otherwise.

**Measurable acceptance criteria.**

- The grid evaluates ≥ 5 threshold profiles over the synthetic baseline and prints all values
  above plus the rejection-reason mix per profile.
- The recommended profile holds qualified participation in the 35–40% band while keeping
  `non_substantive` rejections non-zero (gate still rejects weak content).
- No regression in the existing 98 unit tests; strict typecheck passes; calibration is
  deterministic (same seed, same output).

**Affected metrics.** Review Qualification, Qualified Participation; rejection-reason mix and
weak-pass counts as quality guardrails.

---

## B-03 — Business Follow-Up Velocity and Timeliness Tracking

**Priority:** P2 — **Effort:** S

**Problem statement (why now).** Business follow-up conversion (baseline 3/7 ≈ 0.43) is
currently a thin counter: there is no measure of how quickly a qualified review becomes a
follow-up. The Pivot rule treats follow-up health as a first-class signal ("participation
improves but business follow-up deteriorates"), but we cannot detect deterioration early while
latency is unmeasured. All needed timestamps already exist on the append-only log
(`ReviewQualified.occurredAt`, `BusinessFollowUpCreated.occurredAt` — MVP done), so this is
pure derivation, not new data collection.

**Proposed change.**

- Add a derived **follow-up latency** metric: time from qualification to first follow-up,
  bucketed (< 24h, < 72h, < 7d, ≥ 7d).
- Add a per-type and per-actor breakdown (`intro_call`, `diligence_request`,
  `partner_routing`, `program_invite`; `operations` / `partner`) on the operations dashboard
  and in the CSV export (MVP done).
- Skew the synthetic seed so follow-up latencies populate at least three buckets in the
  baseline dataset.

**Measurable acceptance criteria.**

- Follow-up latency derives purely from the `ReviewQualified → BusinessFollowUpCreated`
  ordering in the log (unit-tested); a follow-up with no qualifying event cannot appear.
- Dashboard and CSV expose latency buckets and the type/actor breakdown; the baseline dataset
  populates ≥ 3 buckets.
- Existing tests stay green; strict typecheck passes.

**Affected metrics.** Business Follow-up Conversion (now with a timeliness dimension feeding
the Pivot rule).

---

## B-04 — Duplicate and Abuse Detection Hardening

**Priority:** P3 — **Effort:** L

**Problem statement (why now).** Duplicate handling today is exact content-hash
first-writer-wins (MVP done) and abuse is a binary `synthetic_bot` profile flag (MVP done).
The directive requires that duplicates and abuse never inflate qualified conversion (§11).
In a scaled synthetic population, paraphrased near-duplicates and multi-signal bot-like
patterns would evade an exact-match hash and silently raise headline rates. This is an
integrity risk to the target metric and a Kill-rule concern (abuse/claim-safety guardrails).
This work stays explicitly non-production and simulated (intent.md §9).

**Proposed change.**

- Add a normalization layer applied before hashing (case folding, punctuation/whitespace
  collapse) so the existing first-writer-wins guard catches mechanically-equivalent text
  regardless of formatting.
- Add near-duplicate detection: a submission whose normalized token overlap with an existing
  submission exceeds a threshold is flagged as a duplicate candidate while the first-writer
  record stays canonical.
- Extend the abuse heuristic from a single binary flag to deterministic multi-signal scoring
  (rapid-repeat submission, boilerplate-only content, same-channel burst, repeated failed
  submissions). All scored signals remain synthetic; flagged records stay separately
  classified and visible to operations (MVP done).

**Measurable acceptance criteria.**

- New synthetic scenarios in the seed: one exact duplicate (existing behavior), one
  paraphrased near-duplicate caught by the overlap threshold, and one multi-signal bot profile
  flagged by heuristics.
- Duplicate and abuse records remain separately classified; qualified conversion excludes
  both — no funnel-semantics change.
- ≥ 8 new tests; existing 98 unit tests stay green; strict typecheck passes.

**Affected metrics.** Review Qualification, Qualified Participation; duplicate/abuse integrity
counters (guardrail).

---

## B-05 — Acknowledgement Reliability and Retry Reporting

**Priority:** P4 — **Effort:** M

**Problem statement (why now).** Acknowledgement success (2/4 = 0.5) is the weakest metric in
the baseline, and a failure is currently a one-shot recorded outcome with no retry path and no
failure taxonomy. The acknowledgement branch is deliberately optional and separate from
conversion (MVP done), so the business impact is low by design — but poor reliability without
reporting is a participant-experience risk and gives the loop no evidence base for improving
the lane.

**Proposed change.**

- Classify simulated acknowledgement failures as **transient (retryable)** or **terminal**,
  with a small taxonomy of simulated error codes.
- Add a bounded retry flow (maximum 3 attempts) for transient failures; each attempt appends
  its own acknowledgement event; outcome resolves to success or terminal failure at the bound.
- Preserve the invariant (directive §10): a failed acknowledgement leaves the qualified review
  qualified and follow-up eligibility untouched.
- Add an acknowledgement reporting slice on the operations dashboard: attempts by error code,
  retry outcomes, and the existing success-rate metric unchanged (successes / attempts).

**Measurable acceptance criteria.**

- Failure taxonomy defines ≥ 2 transient and ≥ 1 terminal simulated error codes.
- The retry command enforces the attempt bound and emits one attempt event per retry; success
  or terminal failure is emitted at the bound.
- Dashboard shows attempt / retry / success breakdown; acknowledgement success remains
  successes / attempts; a unit test proves retries cannot affect qualification or follow-up.
- ≥ 6 new tests; existing 98 unit tests stay green; strict typecheck passes.

**Affected metrics.** Acknowledgement Success (reliability of the optional second branch).

---

## Not Now (deliberately excluded)

- **Real wallet / RPC / on-chain integration.** The wallet branch stays simulated; real
  mainnet transactions are a non-goal for this iteration.
- **Rewards, tokens, TGE or airdrop mechanics.** Incentive logic stays limited to access,
  reviewer status, review priority, and future participation opportunities.
- **Production-grade Sybil or identity verification.** B-04 is a simulation harness only;
  production identity is out of scope.
- **Live campaign tooling or real user data.** The prototype continues to operate on the
  labelled synthetic dataset.
- **Invitation-based gating.** Entry remains open via acquisition channels; no invitation
  token gates eligibility.
- **New acquisition channels or top-of-funnel growth work.** The early funnel is
  near-saturated; the bottleneck, targets, and stop rules point at qualification, guardrails,
  and the post-qualification branches.
- **Multi-language disclosure, mobile app, or persistence/storage backend.** Not required to
  advance the chosen bottleneck in this fictional assessment.