# Final Directive — Web3 Participation Loop

## 1. Objective

Build and demonstrate a measurable Web3 participation loop that moves invited participants through a waitlist, disclosure and review process into qualified participation and legitimate business follow-up.

The system must preserve a low-friction off-chain participation path while supporting optional on-chain acknowledgement.

## 2. Primary Bottleneck

Disclosure/review → qualified reviewer.

## 3. Core Journey

Invitation → Waitlist → Disclosure → Review → Qualification → Business Follow-up → Optional Acknowledgement.

## 4. Scope

The prototype covers:

- invitation;
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

A participant must:

1. receive an invitation;
2. join the waitlist;
3. be eligible for the review round;
4. access the disclosure;
5. submit a review that satisfies the qualification rules.

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

Track:

- invitation_sent
- waitlist_joined
- disclosure_opened
- review_started
- review_submitted
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

## 14. Core Metrics

### Waitlist Activation Rate

Waitlist Joins / Invitations Sent

### Disclosure Engagement Rate

Disclosure Viewers / Waitlist Participants

### Review Submission Rate

Submitted Reviews / Disclosure Viewers

### Review Qualification Rate

Qualified Reviews / Submitted Reviews

### Qualified Participation Rate

Qualified Reviews / Eligible Invited Participants

### Business Follow-up Conversion

Qualified Follow-ups / Qualified Reviews

### Acknowledgement Success Rate

Successful Acknowledgements / Acknowledgement Attempts

Wallet activity must remain separate from qualified participation.

## 15. Synthetic Baseline

The prototype uses synthetic simulation data.

Example:

- 100 invitations;
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

1. invitation;
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

---

# Results / Handoff Appendix

## Artifact Links

### Journey & Participation Rules

[INSERT NOTION LINK]

### Working Prototype

[INSERT VERCEL LINK]

### PRD

[INSERT NOTION LINK]

### Five-item Backlog

[INSERT NOTION LINK]

### Synthetic Dataset

[INSERT GITHUB LINK]

### Dashboard

[INSERT LINK]

### Experiment Brief

[INSERT NOTION LINK]

### Weekly Decision Memo

[INSERT NOTION LINK]

### Source Repository

[INSERT GITHUB LINK]

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

- [ ] Prototype works
- [ ] Invitation → waitlist flow works
- [ ] Valid review qualifies
- [ ] Invalid review rejected
- [ ] Duplicate handled
- [ ] Abuse handled
- [ ] Wallet decline works
- [ ] Acknowledgement failure works
- [ ] Dashboard checked
- [ ] Dataset checked
- [ ] Calculations manually verified
- [ ] Every link opened
- [ ] Repository accessible
- [ ] No credentials/API keys
- [ ] Synthetic data labelled
- [ ] No fabricated research/results
- [ ] Loom ≤5 minutes
- [ ] intent.md complete
- [ ] directive.md complete
