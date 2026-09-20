# Weekly Decision Memo — Web3 Participation Loop

**Iteration:** 1
**Week covering:** Week ending September 20, 2026
**Author role:** Product — MUST Company (fictional hiring assessment)
**Status:** Synthetic prototype milestone; no real-world evidence claimed

---

## Context & What Changed This Week

The Week 1 objective was to take the participation loop from a design intent (intent.md) into a working, measurable prototype (directive.md) without overbuilding. Two canonical model corrections were reconciled this cycle: the entry point is now an **open acquisition channel** (attribution-only, no mandatory personal invitation), and the post-qualification branches — **business follow-up** and **optional on-chain acknowledgement** — are independent, so acknowledgement does not occur after follow-up.

Four bottleneck candidates were evaluated on user value, business conversion, confidence and effort. **Disclosure/review → qualified reviewer** scored highest (5×5×4÷4 = 25) and remains the primary bottleneck: a raw review submission is not useful participation unless it clears the explicit qualification layer. The prototype now implements the full journey — acquisition → waitlist → disclosure → review → qualification — with two independent branches after qualification, a typed append-only event log as the single source of truth, and all metrics derived from that log.

Key changes this week:

- Entry framing switched from invitation to open acquisition channels; the channel is recorded for attribution and does not gate eligibility.
- An explicit seven-gate qualification layer now sits between raw submission and business value.
- Wallet participation made fully optional, and wallet activity separated from qualified participation.
- All simulated operating data shipped and labelled as synthetic.

---

## Decisions

1. **Replace the mandatory personal invitation with open acquisition channels.**
   Rationale: entry friction and gatekeeping were not the primary bottleneck; forcing invitations conflates acquisition with eligibility. The channel is now recorded purely for attribution and never determines eligibility.
   Effect: participant flow is measurable top-of-funnel (acquisition_visited → waitlist_joined) without an invitation-token gate; the early-funnel step is retained under corrected terminology (Acquisition → Waitlist, score 9 unchanged).

2. **Focus this iteration on the Disclosure/Review → Qualified Reviewer bottleneck.**
   Rationale: it has the clearest link between user value and business conversion, and it is where raw submissions, duplicates, abuse and low-quality input accumulate.
   Effect: engineering and measurement effort concentrate on the qualification layer rather than spreading across all four bottlenecks.

3. **Introduce an explicit qualification layer (seven gates) between raw submission and business value.**
   Rationale: a submission is only valuable when it is eligible, disclosure-viewed, complete, disclosure-referenced, substantive, not duplicated, and not abuse-flagged. Qualification must be a first-class decision, not an implicit one.
   Effect: the system can distinguish qualified reviewers from raw submitters, report each gate, and keep vanity metrics (raw submissions, wallet connections) out of business conversion.

4. **Make wallet connection optional; declined or absent wallets never invalidate qualification.**
   Rationale: forcing a wallet would gate useful off-chain participation behind an unrelated step and mislabel wallet activity as business value.
   Effect: `wallet_declined` is recorded as a normal event; wallet activity is measured separately (`wallet_prompted`, `wallet_connected`, `wallet_declined`, acknowledgement events) and is explicitly **not** business conversion.

5. **Generate business follow-up only from qualified reviews; acknowledgement failure preserves qualification.**
   Rationale: follow-up uses limited operational attention and must only run on qualified inputs. Acknowledgement is a separate, optional branch, so a failed acknowledgement must not block the business outcome.
   Effect: follow-up conversion is computed as Qualified Follow-ups / Qualified Reviews, and acknowledgement success is measured on its own (Successful Acknowledgements / Acknowledgement Attempts), independent of follow-up.

6. **Exclude duplicate submissions via content hashing (first-writer-wins).**
   Rationale: duplicates inflate submission counts without adding business value; credits should go to the first writer.
   Effect: `duplicate_detected` is logged, the duplicate never qualifies, and duplicates can never increase qualified conversion.

7. **Classify abuse-flagged synthetic records separately and keep them visible to operations.**
   Rationale: flagged records must not convert, but hiding them would blind operations to the attack surface.
   Effect: `abuse_flagged` records are excluded from qualified conversion per the measurement rules and remain visible in the operations view.

8. **Use an event-sourced, typed, append-only log as the single source of truth.**
   Rationale: every funnel metric must be reproducible from the same trace with no derived-state drift or retroactive edits.
   Effect: the prototype implements the §13 event vocabulary as a PascalCase discriminated union (e.g. `AcquisitionVisited`, `ReviewEvaluated`, `WalletAcknowledgementSucceeded`); all dashboard numbers are derived from the log, and funnel calculations are reproducible.

9. **Ship the synthetic baseline now, labelled as synthetic, and never present it as real performance.**
   Rationale: this is a fictional assessment; the value of the baseline is that the measurement model is exercised end-to-end, not that the numbers predict reality.
   Effect: a 119-event labelled dataset exists, the model is demonstratable in under five minutes, and every metric in this memo is explicitly simulation output.

---

## Evidence & Measured Baseline

The baseline is **synthetic simulation data only**. It exercises the measurement model; it is evidence about the model, not about real market behaviour. The measured qualified participation rate (7/19 eligible ≈ 37%) lands inside the planning target of 35–40%, which is a model sanity check, not a performance forecast.

| Funnel step | Count | Derived rate |
| --- | ---: | ---: |
| Acquisition entries | 20 | — |
| Waitlist joins | 18 | 18/20 = 90% (Waitlist Activation) |
| Disclosure viewers | 16 | 16/18 ≈ 89% (Disclosure Engagement) |
| Review submissions | 14 | 14/16 = 88% (Review Submission) |
| Qualified reviews | 7 | 7/14 = 50% (Review Qualification) |
| Eligible participants | 19 | 7/19 ≈ 37% (Qualified Participation) |
| Business follow-ups | 3 | 3/7 ≈ 43% (Follow-up Conversion) |
| Acknowledgement attempts / successes | 4 / 2 | 2/4 = 50% (Ack Success) |
| Total events logged | 119 | typed, append-only |

Rejection reasons observed (7 rejected submissions): `ineligible`, `non_substantive`, `disclosure_version_mismatch`, `incomplete`, `no_section_reference`.

Read against §17 stop rules, the current read is **Scale-worthy at the model level**: the target metric sits inside band with our quality gates (50% review qualification, 43% follow-up conversion) intact and no abuse signal in the numbers. However — see Risks — a synthetic baseline is the wrong instrument to certify guardrails; this read is provisional on real operating data.

---

## What We Deliberately Did NOT Do

Everything below is out of scope by design (intent.md §9 non-goals). None of it shipped this week:

- **Handle real money, real rewards, a token sale, TGE/airdrop promises, or yield.** Incentives are limited to access, reviewer status, review priority and future participation opportunities.
- **Verify asset ownership or reserves, or deploy production smart contracts / execute mainnet transactions.** Wallet acknowledgement is simulated and off-chain-first.
- **Run a live campaign, conduct live user research, or collect real customer data.** All participants and outcomes are synthetic.
- **Build production-grade Sybil detection.** Abuse classification here is a labelled heuristic for the simulation, explicitly not a defence.
- **Gate participation behind a wallet, or treat wallet activity as business conversion.** Wallet participation is separate by construction.
- **Present any part of the baseline as real-world performance.** The dataset is shipped with a persistent synthetic label.

---

## Risks & Open Questions

- **Synthetic evidence cannot validate quality guardrails.** The 50% review-qualification and 43% follow-up rates are model outputs, not evidence that "substantive" judgement generalizes. Open question: what thresholds on real submissions warrant Scale/Pivot/Kill per §17?
- **Small sample sizes on the lower funnel.** 3 follow-ups and 2 acknowledgement successes are too few to infer stability; the funnel should be re-run with a larger labelled cohort before trusting conversion deltas.
- **Content-hash duplicate logic has edge cases.** First-writer-wins handles near-identical text, but near-duplicate paraphrase and cross-account resubmission need a decision (hash threshold, similarity rule) before live use.
- **Abuse heuristic limits.** Abuse-flagged classification is a labelled heuristic; real-world evasion (synthetic bot distribution) is explicitly out of scope.
- **Attribution-only channels may misattribute.** Open acquisition channels record where a participant arrived, not what caused the arrival; multi-channel and self-attributed entries will need handling rules.
- **Open question on disclosure version mismatch.** We measured it as a rejection reason, but have not decided whether participants should be surfaced a newer disclosure version or whether their submission queues to the correct version.

---

## Next Steps

Priorities for the next cycle, tied to the five-item backlog and the named experiment below:

1. **Experiment: "Structured review template vs. freeform review" (named experiment for Iteration 2) — pre-registered in the experiment brief.** Targeted intervention on Disclosure/Review → Qualified Reviewer: variant B replaces the single freeform text box with a structured three-field review template (disclosure section, substantive question or observation, why it matters), designed to move Qualified Participation within the 35–40% band without inflating raw submissions. Success measure: Review Qualification Rate and Qualified Participation against the 50% / 37% baseline, per the brief's decision rule (≥ +10 pp sustained across both cohorts) with abuse and duplicate guardrails holding.
2. **Prioritize the five-item backlog.** Rank the two highest-value items for the qualified-reviewer bottleneck and pull them into Iteration 2 scope; the plan is captured in the backlog artifact.
3. **Re-run the simulation with a larger labelled cohort** to stabilize the lower-funnel rates before any Scale call.
4. **Decide the disclosure-version-mismatch policy** (re-surface disclosure vs. queue to version) and the near-duplicate threshold.
5. **Reconcile the deck, dashboard and dataset links** in the directive's Results/Handoff appendix so the five-item backlog, synthetic dataset and dashboard are reachable from the handoff.

---

## Final Statement

All results in this memo — the funnel counts, rates, rejection reasons and baseline — are **synthetic simulation data from a fictional hiring assessment for MUST Company**. They exercise and sanity-check the measurement model; they are not real-world evidence of user behaviour, market performance or product-market fit, and they must not be presented as such.

**Prototype:** https://web3-participation-loop-main.vercel.app
**Source:** https://github.com/Flux-web3/Web3-Participation-Loop-COPY