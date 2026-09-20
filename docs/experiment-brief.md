# Experiment Brief: Structured Review Template vs. Freeform Review

| Field | Value |
| --- | --- |
| Product | Web3 Participation Loop — MUST Company (fictional hiring assessment) |
| Primary bottleneck | Disclosure/Review → Qualified Reviewer |
| Primary intervention | Structured review template (variant B) vs. freeform open-text review (variant A) |
| Primary metric | Review Qualification Rate (qualified / submitted) |
| Decision rule | Scale on a ≥ +10 percentage point lift sustained across two cohorts with all guardrails intact |
| Assignment | Randomized 50/50 at waitlist join; unit of randomization = reviewer |
| Minimum sample | 40 eligible per arm (cohort 1) + 40 eligible per arm (confirmatory cohort) |
| Status | Pre-registration draft — no results yet |

> **Synthetic Data Notice.** Every number in this document is a synthetic simulation generated for a fictional hiring assessment. The baseline funnel below is derived from the labelled synthetic prototype dataset (119 events; 20 acquisitions). No real money, no live campaign, no real user data, and no production Sybil detection are involved, and nothing in this brief is represented as real-world performance. The working prototype for reference: https://web3-participation-loop-copy.vercel.app

## 1. Background and Problem

The Web3 participation loop moves participants from open-channel acquisition through waitlist, disclosure, review, and a seven-gate qualification step, after which two independent branches run in parallel: business follow-up and optional on-chain acknowledgement. The loop's value lies in meaningful, qualified participation, not raw submissions.

The labelled synthetic baseline shows where participants are lost:

| Stage | Count | Rate | Definition |
| --- | ---: | ---: | --- |
| Acquisition → Waitlist | 18 / 20 | 0.900 | Waitlist Activation |
| Waitlist → Disclosure | 16 / 18 | 0.889 | Disclosure Engagement |
| Disclosure → Submission | 14 / 16 | 0.875 | Review Submission |
| Submission → Qualified | 7 / 14 | 0.500 | Review Qualification |
| Qualified → Eligible pool | 7 / 19 | 0.368 | Qualified Participation |
| Qualified → Follow-up | 3 / 7 | 0.429 | Business Follow-up Conversion |
| Acknowledgment attempt → success | 2 / 4 | 0.500 | Acknowledgement Success |

The funnel is healthy at the top: activation (0.90), disclosure engagement (0.89), and submission (0.875) all convert strongly. The steepest proportional loss is at the qualification gate: only half of submitted reviews qualify (0.50), which suppresses Qualified Participation (0.37) and limits the material available for legitimate business follow-up (three follow-ups from seven qualified reviews).

The planning target is Qualified Participation toward 35–40% at acceptable quality and abuse levels. Because the downstream steps are starved by the qualification gate, raising Review Qualification is the highest-leverage synthetic lever available.

## 2. Hypothesis

A structured review template will raise Review Qualification Rate relative to freeform review and thereby increase Qualified Participation, without materially increasing duplicate or abuse-flagged records.

- **Specific.** Structured (B) requires three explicitly labelled fields corresponding to the directive's review requirements — disclosure section, substantive question or observation, and explanation of why it matters — plus per-field guidance and a minimum length. Freeform (A) is a single open text box.
- **Falsifiable.** If B does not exceed A in Review Qualification Rate by a meaningful margin (≥ +10 pp across two cohorts), or if quality or abuse guardrails regress, the hypothesis is rejected.
- **Expected direction.** B ≥ A for Review Qualification Rate. Expected effect size is anchored on the observed baseline: control qualification rate ~0.50, structured-target ~0.60–0.65. At the planning target, an improved qualification rate should move Qualified Participation from ~0.37 toward 35–40% at unchanged eligibility.

The mechanism is direct: the majority of the seven gates are content gates (Complete, Disclosure Referenced, Substantive). A template that enforces these fields should convert a larger share of submissions into qualified reviews, with the funnel's measured response expected primarily at `review_evaluated → review_qualified`.

## 3. Why This Bottleneck

- **Largest recoverable loss.** The qualification gate loses 50% of submissions (14 → 7); the top-funnel steps already convert at ~0.88 or better and have little headroom by comparison.
- **Content gates, not access gates.** Two of the seven gates are attributes set upstream (Eligible, Disclosure Viewed). Five are content and integrity gates (Complete, Disclosure Referenced, Substantive, Not Duplicate, Not Abuse Flagged). The intervention targets exactly the content gates where submissions fail.
- **Business conversion linkage.** Qualified reviews are the sole input to Business Follow-up Conversion (3/7) and are separated from the optional wallet branch. Improving qualification grows the pool the business branch converts, consistent with the core principle that raw submissions are not valuable participation.
- **Runs with non-goals.** The experiment requires no real money, incentives beyond permitted access/status/priority/future participation, wallet involvement, or production Sybil infrastructure. A disclosure-presentation variant (A/B on disclosure layout) was considered and rejected because disclosure engagement is already strong (0.889) and the minimal viewer loss is not the binding constraint; the template intervention targets the binding constraint instead.

## 4. Experiment Design

### 4.1 Variant Definitions

| Variant | Review interface | What the reviewer sees |
| --- | --- | --- |
| A — Freeform (control) | Single open-text box (~500 character minimum shown as guidance, not enforced) | No field structure; reviewer describes feedback however they choose |
| B — Structured (treatment) | Three mandatory labelled fields: (1) Disclosure section referenced, (2) Substantive question or observation, (3) Why it matters; 100-character minimum per field; inline example prompts | Submitted only when all three fields are non-empty; partial state auto-saved |

Both variants share the same disclosure content, acquisition path, waitlist, qualification gates, and post-qualification branches. Only the review-entry interface differs. Wallet connection remains optional in both arms; declining a wallet does not invalidate qualification.

### 4.2 Assignment Mechanism

- Randomization unit: the reviewer (participant).
- Method: deterministic pseudo-random assignment at waitlist join, 50/50 to A or B. A seeded hash of the participant's waitlist session key selects the arm so assignment is stable across the participant's events and replayable in the simulation.
- Stratification: assignment is stratified by acquisition channel (direct, referral, campaign, community, partner, social, other) to prevent channel mix from biasing arm comparison.
- Blind: single-blind — reviewers are not told the loop is randomized or which arm they are in.
- Intent to treat: participants are analysed in the arm they were assigned to at waitlist join, and the funnel for each arm is derived from the append-only event log.

### 4.3 Sample Size and Minimum Sample

- Minimum sample: 40 eligible participants per arm per cohort (80 eligible for the first decision, 160 eligible pooled for the confirmatory decision).
- Translation to acquisition volume: eligibility is a synthetic attribute running at ~95% (19 eligible / 20 acquisitions). Forty eligible per arm requires ~42 acquisitions per arm, or ~84 acquisitions across both arms per cohort — roughly 4.2× the 20-acquisition baseline round.
- Rationale for 40 eligible/arm: this is the pre-registered floor for a simulation-sized A/B. It is acknowledged to be underpowered for small effects (at n = 40 per arm, ~35–40% power for a 15 pp lift, α = 0.05 one-sided), which is why the decision rule requires two cohorts and a staged ramp rather than a single-shot Scale.

### 4.4 Duration Rationale

- Standard test window: run until each arm has reached 40 eligible participants, simulated as 7–8 additional synthetic rounds (each round approximating the 119-event baseline cohort) over an approximate three to four simulated weeks, with acquisitions added in labelled batches.
- No efficacy decision is made before the minimum sample. An interim look at 50% enrolment is permitted only for operational safety and abuse guardrails (no peeking on efficacy).
- If one arm fills materially faster than the other, the experiment continues until the slower arm reaches the minimum; duration is controlled by the slowest arm.

## 5. Primary Metric and Decision Rule

**Primary metric: Review Qualification Rate** (Qualified Reviews / Submitted Reviews).

This is the direct response of the bottleneck step the intervention targets and the foundation of Qualified Participation.

| Element | Specification |
| --- | --- |
| Primary metric | Review Qualification Rate = review_qualified / review_submitted |
| Expected control | ~0.50 (labelled synthetic baseline) |
| Expected treatment | ~0.60–0.65 |
| Decision threshold | Scale requires treatment ≥ control + 10 pp in **both** cohort 1 and the confirmatory cohort, with the one-sided lower confidence bound above 0 and all guardrails passing |
| Statistical test | Two-sample one-sided proportion test (with continuity correction; Fisher's exact where cell counts are small); 95% confidence intervals reported |
| Meaning of no effect | Treatment ≤ control + 5 pp after the confirmatory cohort → Kill per stop rules |
| Tie to target | Only a lift that moves Qualified Participation toward 35–40% at stable quality and abuse is eligible for Scale |

## 6. Secondary Metrics

| Metric | Definition | Role |
| --- | --- | --- |
| Qualified Participation Rate | Qualified / Eligible | Business target tie-breaker (planning target 35–40%) |
| Disclosure Engagement Rate | Viewers / Waitlist | Confirmation that assignment did not disturb access |
| Review Submission Rate | Submitted / Viewers | Friction guardrail — the template must not suppress submissions |
| Business Follow-up Conversion | Follow-ups / Qualified | Quality-as-conversion — hollow submissions should produce fewer follow-ups |
| Gate-level pass rates | `review_evaluated` gates (Complete, Disclosure Referenced, Substantive) | Diagnose which gates the template fixes |
| Duplicate rate | duplicate_detected / 100 submitted | Integrity guardrail |
| Abuse-flagged rate | abuse_flagged / 100 submitted | Abuse guardrail |
| Acknowledgement Success Rate | Succeeded / Attempts | Separately tracked; must not be affected (wallet branch is independent) |

## 7. Guardrails

Guardrails reference the directive stop rules: **Scale** requires improvement with acceptable quality and abuse; **Pivot** fires when participation up but quality/follow-up down; **Kill** fires on no meaningful improvement or unacceptable risk.

| Guardrail | Metric | Failure threshold | Referenced stop rule |
| --- | --- | --- | --- |
| Friction | Review Submission Rate (B vs A) | B ≥ 10 pp below A → treat as design failure, review before any Scale | Kill (operational) |
| Quality | Business Follow-up Conversion (B vs A) | B more than 5 pp below A → quality regressed | Pivot |
| Substance | Median submitted length and Disclosure-Referenced gate pass rate | B not higher than A → template does not add substance | Pivot |
| Abuse | abuse_flagged / 100 submitted (B vs A) | B above A by +2 / 100 submitted → abuse regressed | Kill |
| Duplicates | duplicate_detected / 100 submitted (B vs A) | B above A by +2 / 100 submitted → duplicate handling overloaded | Kill |
| Claim safety / incentives | Review content and UX | Any token, TGE, airdrop, yield, reward or return promise in either arm → immediate Kill and review | Kill (claim safety) |
| Wallet independence | Acknowledgement Success Rate and Branch metrics | Wallet activity gating qualification or follow-up → violates directive §9–§10 | Kill |

## 8. Analysis Plan

- **Analysis type.** Variant comparison of independent randomized arms (A vs B). Pre/post control-arm comparison is reported only as an internal consistency check; arm comparison is the decision basis, because both arms share the same time window and acquisition conditions.
- **Stages.** (1) Balance check: arm balance on acquisition channel mix, waitlist activation, eligibility rate, and disclosure engagement before outcome readout; any imbalance flags the analysis as confounded. (2) Primary readout at 40 eligible per arm. (3) Confirmatory readout at 40 eligible per arm in a second, freshly randomized cohort.
- **What "improvement" means.** Treatment Review Qualification Rate ≥ control + 10 pp with the one-sided confidence bound above 0, sustained across both cohorts, no guardrail breach, and Qualified Participation moving toward 35–40%.
- **Statistical reporting.** Point estimates, differences, 95% confidence intervals, and p-values for the primary and secondary proportion metrics; guardrail tests at one-sided 10% significance to favour safety sensitivity.
- **Peeking control.** No efficacy tests before the minimum sample. Interim looks restricted to operational and abuse safety.
- **Stop-rule handling.** Thresholds are pre-registered and unchanged by interim reads; adoption proceeds as a staged ramp (10% → 50% → 100% of waitlist traffic) only after the confirmatory cohort.
- **Reproducibility.** Simulation is seeded and replayable; every metric is derived from the labelled append-only synthetic event log; results will be recorded against labelled records, not asserted from memory. Prototype for reference: https://web3-participation-loop-copy.vercel.app

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Template friction suppresses submissions | Medium | Primary metric looks better but participation falls | Submission-rate friction guardrail (§7); require-non-empty but low minimum length; inline examples; partial-state autosave |
| Superficial "checklist" submissions that satisfy fields without substance | Medium | Qualification rises but follow-up quality falls | Substance guardrail: median length, Referenced-gate pass rate, sampled manual QA by Operations, Follow-up Conversion guardrail |
| Sample size too small for small true effects | High at 40/arm | False Kill of a weak-but-real improvement | Pre-registered +10 pp meaningful effect, confirmatory cohort, staged ramp; 5–10 pp consistent gains trigger a retest, not an immediate Kill |
| Channel-mix imbalance between arms | Low (stratified) | Confounded result | Stratified assignment by channel plus balance table prior to readout |
| Temporal drift between cohorts | Medium | Cohort 2 differs for reasons other than the template | Confirmatory cohort shares the same measurement window; comparison is within-cohort A vs B |
| Peeking and premature stopping | Low (controlled) | Inflated false-positive rate | Pre-registered thresholds; safety-only interim looks |
| Abuse or synthetic-bot inflation of the template | Medium | Integrity metrics degrade | Abuse and duplicate guardrails; synthetic abuse scenarios included in every cohort; abuse funnel measured separately and reported to operations |

## 10. Success Criteria: Scale / Pivot / Kill

| Decision | Trigger | Action |
| --- | --- | --- |
| **Scale** | Structured ≥ freeform + 10 pp on Review Qualification in both cohort 1 and the confirmatory cohort; all §7 guardrails pass; Qualified Participation trending to 35–40% | Roll the structured template out to all waitlist participants (staged ramp), keep the freeform arm as a masked control for one further cohort, then adopt |
| **Pivot** | Participation or qualification improves but Business Follow-up Conversion or substance quality regresses beyond guardrails | Keep participation but redesign the template (relax constraint, add coaching copy, or re-run A/B on a revised B); original freeform remains available to reviewers who abandon the template |
| **Kill** | Minimum sample reached with treatment ≤ control + 5 pp or no consistent direction; or any guardrail failure classified as operational, abuse, or claim-safety (forbidden incentives, wallet gating, unhandled error rate) | Discontinue the structured variant, record the outcome in the synthetic log, document the decision for operations |

## 11. Results and Completion

This brief is a pre-registration for a fictional hiring assessment. **No results are reported here, and none will be asserted as real.** Once the seeded simulation is run, observed rates for all metrics in §5–§7 will be appended to this document as labelled synthetic outputs, with the Scale/Pivot/Kill decision justified against the thresholds above. No number in this document describes real users, real money, or a live campaign.