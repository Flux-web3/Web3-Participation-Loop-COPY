import type {
  AcknowledgementId,
  DisclosureId,
  FollowUpId,
  ParticipantId,
  ReviewId,
  SectionId,
} from './ids';
import type {
  AbuseProfile,
  Channel,
  EligibilityStatus,
  FollowUpActor,
  FollowUpType,
  GateId,
  ParticipantStatus,
  RejectionReason,
  ReviewDisposition,
  WalletAckStatus,
} from './enums';

// ---------------------------------------------------------------------------
// Reference data: the synthetic disclosure document under review.
// ---------------------------------------------------------------------------

export interface DisclosureSection {
  id: SectionId;
  title: string;
  body: string;
}

export interface Disclosure {
  id: DisclosureId;
  version: number;
  title: string;
  sections: DisclosureSection[];
  disclaimer: string;
}

/** A participant's recorded view of a specific disclosure version. */
export interface DisclosureView {
  disclosureId: DisclosureId;
  disclosureVersion: number;
  sectionsSeen: SectionId[];
}

// ---------------------------------------------------------------------------
// Review content and evaluation.
// ---------------------------------------------------------------------------

/** Structured review fields captured from the participant. */
export interface ReviewContent {
  /** The disclosure section the review addresses. */
  section: SectionId;
  /** A specific question about the disclosure. */
  question: string;
  /** Why the question matters (the substantive observation). */
  whyItMatters: string;
}

/** A submitted review plus fields derived at submission time. */
export interface Review {
  id: ReviewId;
  participantId: ParticipantId;
  content: ReviewContent;
  /** Disclosure version the participant reviewed against. */
  disclosureVersion: number;
  /** Normalized-content hash used for duplicate detection. */
  contentHash: string;
  wordCount: number;
}

/** One gate's result within a qualification evaluation. */
export interface GateCheck {
  gate: GateId;
  passed: boolean;
  note?: string;
}

/** The full result of evaluating a review against the seven gates. */
export interface QualificationResult {
  disposition: ReviewDisposition;
  /** All seven gate checks, in canonical order (full breakdown is retained). */
  checks: GateCheck[];
  /** Set when disposition === 'rejected'. */
  primaryReason?: RejectionReason;
  /** Set when disposition === 'duplicate' (the first-writer review). */
  duplicateOfReviewId?: ReviewId;
  /** True iff disposition === 'qualified'. Gates business follow-up eligibility. */
  qualifiesForConversion: boolean;
}

// ---------------------------------------------------------------------------
// Participant lifecycle (derived projection, not authored directly).
// ---------------------------------------------------------------------------

export interface Participant {
  id: ParticipantId;
  channel: Channel;
  eligibility: EligibilityStatus;
  abuseProfile: AbuseProfile;
  status: ParticipantStatus;
}

// ---------------------------------------------------------------------------
// Business (operations/partner) lane.
// ---------------------------------------------------------------------------

export interface BusinessFollowUp {
  id: FollowUpId;
  reviewId: ReviewId;
  participantId: ParticipantId;
  followUpType: FollowUpType;
  actor: FollowUpActor;
}

// ---------------------------------------------------------------------------
// Orthogonal wallet side-channel (simulated only — no SDK/RPC/mainnet).
// ---------------------------------------------------------------------------

export interface WalletAcknowledgement {
  id: AcknowledgementId;
  participantId: ParticipantId;
  status: WalletAckStatus;
  /** Fake reference on success, e.g. "SIM-ACK-001". */
  simulatedRef?: string;
  /** Simulated error code on failure. */
  errorCode?: string;
}
