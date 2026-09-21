# Participation Rules — Web3 Participation Loop

## Scope and Context

This document defines the operating rules of the Web3 participation loop for **MUST Company**. It is part of a **fictional hiring assessment**. It does not describe a live product, real users, or real-world performance.

- All participants are synthetic.
- All outcomes, simulations, and metrics are synthetic or simulated.
- No real money is processed, no tokens or rewards are issued, and no investment return or ownership is guaranteed.
- The rules below are the canonical reference: every funnel stage, qualification decision, rejection reason, abuse classification, wallet outcome, and measurement definition follows these rules.

## Participation Model

The loop moves a participant through five sequential stages, followed by two independent post-qualification branches.

Core journey:

1. **Entry and Acquisition** — a person arrives through an open acquisition channel.
2. **Waitlist** — an acquired person registers for the review opportunity.
3. **Disclosure** — a waitlisted participant opens the project disclosure.
4. **Review** — the participant submits a structured review.
5. **Qualification** — the review is evaluated against the qualification rules.

After qualification, two independent branches run in parallel and do not depend on each other:

- **Business follow-up** — legitimate follow-up activity generated from a qualified review.
- **Optional on-chain acknowledgement** — an optional, separately measured wallet acknowledgement.

Neither branch is a precondition for the other. Acknowledgement does not occur after business follow-up.

## Entry and Acquisition Rules

- Entry is open. A personal invitation is **not required**.
- A participant may arrive through any of the open acquisition channels: **direct, referral, campaign, community, partner, social, other**.
- The acquisition channel is recorded for **attribution only**. It does not determine eligibility.
- An acquisition channel must be labelled upon entry, but no channel is privileged over another.
- Entry does not confer eligibility. Eligibility is a synthetic attribute evaluated at qualification, not at entry.

## Waitlist Rules

- A waitlisted participant is an acquired person who has registered for the review opportunity.
- Joining the waitlist records a `waitlist_joined` event attributable to the acquisition channel.
- Waitlisting does not require a wallet connection and does not require disclosure access.
- Being on the waitlist is necessary but not sufficient for qualification.

## Disclosure and Versioning Rules

- The project disclosure is a documented set of information that a waitlisted participant opens before reviewing.
- The disclosure is **documented with a version**. Every opened disclosure instance is bound to a specific version.
- A review must reference a disclosure section and must match the disclosure version that was presented.
- Participants must open the disclosure (`disclosure_opened`) before a review can be evaluated as complete.
- Reviewing against a stale or unmatched disclosure version is a rejection reason (see Qualification Rules).

## Review Rules

### Required Fields

A review submission must include:

- **disclosure section** — the section of the disclosure the review addresses;
- **question or observation** — a substantive question or observation about that section;
- **whyItMatters** — an explanation of why the question or observation matters.

### Substance Bar

To be treated as substantive, a review must offer a genuine question or observation with a reasoned explanation of why it matters. Generic or boilerplate content does not qualify.

### Content Integrity and Hashing

- The substantive fields — `question` and `whyItMatters` — are normalized and content-hashed using **SHA-256**.
- The hash covers the normalized substantive content of the review.
- **Re-tagging a different section does not evade duplicate detection.** Two reviews with identical substantive content are the same content regardless of the disclosure section chosen.

### First-Writer-Wins Duplicate Rule

- First *valid* writer wins: the earliest **qualified** review of a given normalized content
  (SHA-256 hash of the question and why-it-matters fields) owns that content.
- Any later submission of identical content is a **duplicate** of that qualified review.
- An earlier copy that was rejected or abuse-flagged does not own the content, so it cannot
  block a later valid review; that later review is evaluated on its own merits.
- A duplicate is recorded as `duplicate_detected` and never increases qualified conversion.

## Qualification Rules

### Seven-Gate Definition

A review is **qualified** when **ALL** of the following hold:

1. **Eligible** — the participant's synthetic eligibility attribute passes.
2. **Disclosure Viewed** — the participant opened the disclosure.
3. **Complete** — all required fields are present.
4. **Disclosure Referenced** — the review references a valid disclosure section.
5. **Substantive** — the content meets the substance bar.
6. **Not Duplicate** — the content is not a duplicate of an earlier submission.
7. **Not Abuse Flagged** — the participant is not classified on the synthetic abuse profile.

Every evaluated review produces an evaluation event (`review_evaluated`) with an outcome of `review_qualified` or `review_rejected`.

### Rejection Reasons

A review is rejected and the reason recorded when any gate fails:

| Reason | Meaning |
| --- | --- |
| `ineligible` | Participant fails the eligibility attribute. |
| `non_substantive` | Content is too generic or boilerplate. |
| `disclosure_version_mismatch` | Review references a stale or unmatched disclosure version. |
| `incomplete` | A required field is missing. |
| `no_section_reference` | No valid disclosure section is referenced. |

A rejected review does not convert and cannot become the basis of business follow-up.

## Abuse Rules

- Participants may be classified on a **synthetic abuse profile** (for example, bot/abusive).
- Classification is simulation data, not production-grade Sybil detection.
- **Abuse-flagged records never convert** — they are excluded from qualified conversion and from business follow-up.
- Abuse-flagged records **remain visible to operations** so operators can inspect and monitor them.
- An abuse classification on any record does not convert even if the review content is otherwise complete and substantive.

## Wallet Rules

Wallet participation is **optional at every step**.

- At each prompted step a participant may choose:
  - **Connect Wallet**, or
  - **Continue Without Wallet**.
- Declining wallet connection must **never invalidate qualified participation**.
- A participant who declines is recorded via `wallet_declined` and continues through the loop on the same terms as a participant who connects.
- Valid wallet outcomes for a qualified participant:

| Outcome | Meaning |
| --- | --- |
| `not_attempted` | Participant was never prompted or chose not to attempt. |
| `declined` | Participant chose to continue without wallet. |
| `pending` | Acknowledgement was attempted; outcome not yet resolved. |
| `failed` | Connection was attempted but failed. |
| `success` | Connection succeeded. |

All five outcomes are consistent with a qualified participant. None of them changes qualification status.

## Acknowledgement Rules

- On-chain acknowledgement is **optional** and occurs only on the on-chain branch, independently of business follow-up.
- If an acknowledgement **succeeds**, the success is recorded (`acknowledgement_succeeded`).
- If an acknowledgement **fails**, the failure is recorded (`acknowledgement_failed`) and:
  - the review **remains qualified**;
  - business-follow-up eligibility is **unaffected**.
- Acknowledgement failure never invalidates qualification and never blocks or triggers follow-up.

## Business Follow-up Rules

- **Business follow-ups are only generated from qualified reviews.** Unqualified, rejected, duplicate, and abuse-flagged reviews never generate follow-up.
- Follow-up is recorded as `followup_created` and counted as a business conversion.
- Legitimate follow-up examples:
  - **review call** — a conversation about the review;
  - **information request** — a request for further information;
  - **partner/practitioner conversation** — a business or practitioner discussion.
- A wallet action is not a business conversion and never counts as follow-up.

## Incentive Limits

Permitted incentives are limited to participation and access benefits:

- access;
- reviewer status;
- review priority;
- future participation opportunities.

**Never promised**, in any communication or UI copy:

- tokens;
- TGE allocation;
- airdrop;
- yield;
- investment return;
- ownership guarantees.

No incentive that implies financial value or guaranteed reward may be offered.

## Measurement Separation

- Wallet activity and business follow-up are **separately measured**.
- A **wallet action is not a business conversion**.
- A **business follow-up is not a wallet conversion**.
- Metrics are derived from an append-only event log that is the single source of truth.
- Raw submissions are distinguishable from qualified reviews; qualified reviews are distinguishable from follow-ups; acknowledgement attempts are distinguishable from acknowledgement successes.

## Rules Summary

| Area | Rule |
| --- | --- |
| Entry | Open channels; invitation not required; channel is attribution only. |
| Waitlist | Acquired person registers for the review opportunity. |
| Disclosure | Documented with a version; must be opened and version-matched. |
| Review fields | Disclosure section + substantive question/observation + why it matters. |
| Content integrity | SHA-256 over normalized question + whyItMatters; section re-tagging does not evade duplicates. |
| Duplicates | First-writer-wins; later identical submissions never increase qualified conversion. |
| Qualification | All seven gates: Eligible, Disclosure Viewed, Complete, Disclosure Referenced, Substantive, Not Duplicate, Not Abuse Flagged. |
| Rejections | ineligible, non_substantive, disclosure_version_mismatch, incomplete, no_section_reference. |
| Abuse | Synthetic profile classification; never converts; visible to operations. |
| Wallet | Optional at every step; decline never invalidates; outcomes not_attempted/declined/pending/failed/success all valid. |
| Acknowledgement | Failure recorded; review stays qualified; follow-up eligibility unaffected. |
| Business follow-up | Only from qualified reviews; review call, information request, partner/practitioner conversation. |
| Incentives | Access, reviewer status, review priority, future participation only; never tokens, TGE, airdrop, yield, return, ownership. |
| Measurement | Wallet activity and business follow-up measured separately; neither counts as the other. |

## Prototype Mapping

The rules above are demonstrated in the working prototype at **https://web3-participation-loop.vercel.app**:

- The five-stage core journey is shown under the **#journey** route (acquisition channel selection, waitlist registration, disclosure access and version, review submission with the three required fields, and the seven-gate qualification result).
- Qualified and rejected outcomes, rejection reasons, duplicate detection, abuse classification, wallet outcomes (`not_attempted`/`declined`/`pending`/`failed`/`success`), acknowledgement success and failure, and follow-up creation are demonstrated in the journey against synthetic data.
- The **#dashboard** route maps to the Measurement Separation rules: waitlist activation, disclosure engagement, review submission, review qualification, qualified participation, business follow-up conversion, and acknowledgement success rate are shown as separate funnel metrics, with wallet activity kept separate from business conversion.
- Scenario coverage in the prototype includes: valid review qualifies, invalid review rejected, duplicate submission handled, abuse scenario handled, wallet decline supported, and acknowledgement failure preserving qualification.