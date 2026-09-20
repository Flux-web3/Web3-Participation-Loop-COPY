import type {
  AcknowledgementId,
  DisclosureId,
  EventId,
  FollowUpId,
  ParticipantId,
  ReviewId,
  SectionId,
} from '../ids';
import type {
  AbuseProfile,
  Channel,
  EligibilityStatus,
  FollowUpActor,
  FollowUpType,
  RejectionReason,
  ReviewDisposition,
} from '../enums';
import type { GateCheck, ReviewContent } from '../entities';

/**
 * The complete set of domain event types, in rough lifecycle order.
 * The append-only log of these events is the single source of truth; every
 * metric is derived from them (never from mutable counters).
 */
export const EVENT_TYPES = [
  'AcquisitionVisited',
  'WaitlistRegistered',
  'DisclosureViewed',
  'ReviewSubmitted',
  'ReviewEvaluated',
  'ReviewQualified',
  'ReviewRejected',
  'ReviewFlaggedDuplicate',
  'ReviewFlaggedAbuse',
  'BusinessFollowUpCreated',
  'WalletPrompted',
  'WalletConnectionDeclined',
  'WalletConnected',
  'WalletAcknowledgementAttempted',
  'WalletAcknowledgementSucceeded',
  'WalletAcknowledgementFailed',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Common envelope for every event. `sequence` is a monotonic integer assigned
 * by the store and is the authoritative ordering (timestamps are for display,
 * not ordering).
 */
export interface BaseEvent {
  sequence: number;
  id: EventId;
  type: EventType;
  occurredAt: string; // ISO-8601
  participantId?: ParticipantId;
  channel?: Channel;
}

// --- Funnel family -------------------------------------------------------

/**
 * A visitor arrives through an acquisition channel and becomes a tracked
 * participant. Entry is open — no personal invitation token is required.
 * Synthetic attributes (eligibility, abuse profile) are minted here; they do
 * NOT gate entry, only later qualification. `channel` is recorded for
 * attribution.
 */
export interface AcquisitionVisitedEvent extends BaseEvent {
  type: 'AcquisitionVisited';
  participantId: ParticipantId;
  channel: Channel;
  eligibility: EligibilityStatus;
  abuseProfile: AbuseProfile;
}

export interface WaitlistRegisteredEvent extends BaseEvent {
  type: 'WaitlistRegistered';
  participantId: ParticipantId;
  channel: Channel;
}

export interface DisclosureViewedEvent extends BaseEvent {
  type: 'DisclosureViewed';
  participantId: ParticipantId;
  disclosureId: DisclosureId;
  disclosureVersion: number;
  sectionsSeen: SectionId[];
}

export interface ReviewSubmittedEvent extends BaseEvent {
  type: 'ReviewSubmitted';
  participantId: ParticipantId;
  reviewId: ReviewId;
  disclosureId: DisclosureId;
  /** Version the participant reviewed against (must match viewed version to qualify). */
  disclosureVersion: number;
  content: ReviewContent;
  contentHash: string;
  wordCount: number;
}

// --- Quality family (evaluation + non-qualifying dispositions) -----------

/** Full audit record of a review evaluation: disposition + all seven gate checks. */
export interface ReviewEvaluatedEvent extends BaseEvent {
  type: 'ReviewEvaluated';
  participantId: ParticipantId;
  reviewId: ReviewId;
  disposition: ReviewDisposition;
  checks: GateCheck[];
  primaryReason?: RejectionReason;
  duplicateOfReviewId?: ReviewId;
}

export interface ReviewRejectedEvent extends BaseEvent {
  type: 'ReviewRejected';
  participantId: ParticipantId;
  reviewId: ReviewId;
  reason: RejectionReason;
}

export interface ReviewFlaggedDuplicateEvent extends BaseEvent {
  type: 'ReviewFlaggedDuplicate';
  participantId: ParticipantId;
  reviewId: ReviewId;
  duplicateOfReviewId: ReviewId;
}

export interface ReviewFlaggedAbuseEvent extends BaseEvent {
  type: 'ReviewFlaggedAbuse';
  participantId: ParticipantId;
  reviewId: ReviewId;
  signals: string[];
}

// --- Qualified family ----------------------------------------------------

/** Terminal marker for a qualifying review. At most one per participant (idempotent). */
export interface ReviewQualifiedEvent extends BaseEvent {
  type: 'ReviewQualified';
  participantId: ParticipantId;
  reviewId: ReviewId;
}

// --- Conversion family ---------------------------------------------------

export interface BusinessFollowUpCreatedEvent extends BaseEvent {
  type: 'BusinessFollowUpCreated';
  participantId: ParticipantId;
  followUpId: FollowUpId;
  reviewId: ReviewId;
  followUpType: FollowUpType;
  actor: FollowUpActor;
}

// --- Wallet family (orthogonal, simulated only) --------------------------

/** Ops prompts the qualified participant to optionally acknowledge on-chain. */
export interface WalletPromptedEvent extends BaseEvent {
  type: 'WalletPrompted';
  participantId: ParticipantId;
  reviewId?: ReviewId;
}

export interface WalletConnectionDeclinedEvent extends BaseEvent {
  type: 'WalletConnectionDeclined';
  participantId: ParticipantId;
  reviewId?: ReviewId;
}

/** Participant opts to connect a (simulated) wallet. Still entirely optional. */
export interface WalletConnectedEvent extends BaseEvent {
  type: 'WalletConnected';
  participantId: ParticipantId;
  reviewId?: ReviewId;
}

export interface WalletAcknowledgementAttemptedEvent extends BaseEvent {
  type: 'WalletAcknowledgementAttempted';
  participantId: ParticipantId;
  acknowledgementId: AcknowledgementId;
  reviewId?: ReviewId;
}

export interface WalletAcknowledgementSucceededEvent extends BaseEvent {
  type: 'WalletAcknowledgementSucceeded';
  participantId: ParticipantId;
  acknowledgementId: AcknowledgementId;
  /** Fake reference such as "SIM-ACK-001" — no real transaction hash. */
  simulatedRef: string;
}

export interface WalletAcknowledgementFailedEvent extends BaseEvent {
  type: 'WalletAcknowledgementFailed';
  participantId: ParticipantId;
  acknowledgementId: AcknowledgementId;
  errorCode: string;
}

/** Discriminated union of every domain event, keyed on `type`. */
export type DomainEvent =
  | AcquisitionVisitedEvent
  | WaitlistRegisteredEvent
  | DisclosureViewedEvent
  | ReviewSubmittedEvent
  | ReviewEvaluatedEvent
  | ReviewRejectedEvent
  | ReviewFlaggedDuplicateEvent
  | ReviewFlaggedAbuseEvent
  | ReviewQualifiedEvent
  | BusinessFollowUpCreatedEvent
  | WalletPromptedEvent
  | WalletConnectionDeclinedEvent
  | WalletConnectedEvent
  | WalletAcknowledgementAttemptedEvent
  | WalletAcknowledgementSucceededEvent
  | WalletAcknowledgementFailedEvent;

/** Narrow the union to a single event type by its `type` discriminant. */
export type EventOfType<T extends EventType> = Extract<DomainEvent, { type: T }>;

/** Distributive Omit that preserves the discriminated union across members. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * An event ready to be appended: the store assigns `sequence` and `id`, so a
 * caller supplies everything else.
 */
export type NewEvent = DistributiveOmit<DomainEvent, 'sequence' | 'id'>;
