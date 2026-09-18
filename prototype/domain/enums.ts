// Closed enumerations for the domain, expressed as `as const` arrays with a
// derived union type. The arrays give runtime iteration (validation, seeding,
// exhaustiveness tests); the types give compile-time safety.

/**
 * Acquisition channels a participant can arrive through. Entry is open: arriving
 * via any channel is sufficient to join the waitlist — no personal invitation
 * token is required. The channel is recorded purely for attribution.
 */
export const CHANNELS = [
  'direct',
  'referral',
  'campaign',
  'community',
  'partner',
  'social',
  'other',
] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Synthetic eligibility attribute. Eligibility does NOT gate acquisition or the
 * waitlist join — it is a latent attribute evaluated only at the `eligible`
 * qualification gate.
 */
export const ELIGIBILITY_STATUSES = ['eligible', 'ineligible'] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

/** Synthetic integrity label (NOT a production Sybil detector — see intent.md §9). */
export const ABUSE_PROFILES = ['clean', 'synthetic_bot'] as const;
export type AbuseProfile = (typeof ABUSE_PROFILES)[number];

/** Derived participant lifecycle state (projected from the event log). */
export const PARTICIPANT_STATUSES = [
  'acquired',
  'waitlisted',
  'disclosure_viewed',
  'review_submitted',
  'qualified',
  'disqualified',
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** Outcome of evaluating a submitted review. */
export const REVIEW_DISPOSITIONS = ['qualified', 'rejected', 'duplicate', 'abuse_flagged'] as const;
export type ReviewDisposition = (typeof REVIEW_DISPOSITIONS)[number];

/** Specific reason a review was rejected (disposition === 'rejected'). */
export const REJECTION_REASONS = [
  'ineligible',
  'disclosure_not_viewed',
  'disclosure_version_mismatch',
  'incomplete',
  'no_section_reference',
  'non_substantive',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * The seven qualification gates, in canonical display/evaluation order.
 * (Failure *precedence* is a separate ordering — see qualification/gates.ts.)
 */
export const GATE_IDS = [
  'eligible',
  'disclosure_viewed',
  'complete',
  'section_referenced',
  'substantive',
  'not_duplicate',
  'not_abuse',
] as const;
export type GateId = (typeof GATE_IDS)[number];

/** Simulated wallet acknowledgement state (orthogonal side-channel). */
export const WALLET_ACK_STATUSES = ['not_attempted', 'declined', 'pending', 'success', 'failed'] as const;
export type WalletAckStatus = (typeof WALLET_ACK_STATUSES)[number];

/** Kinds of legitimate business follow-up on a qualified review. */
export const FOLLOW_UP_TYPES = ['intro_call', 'diligence_request', 'partner_routing', 'program_invite'] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

/** Who performs the follow-up (operations lane vs partner lane). */
export const FOLLOW_UP_ACTORS = ['operations', 'partner'] as const;
export type FollowUpActor = (typeof FOLLOW_UP_ACTORS)[number];
