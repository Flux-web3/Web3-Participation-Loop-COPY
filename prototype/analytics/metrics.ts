import type {
  Channel,
  DomainEvent,
  EventType,
  ParticipantId,
  RejectionReason,
  ReviewDisposition,
  WalletAckStatus,
} from '@/domain';
import { CHANNELS } from '@/domain';
import { deriveStatus, deriveWalletStatus, projectParticipant } from '@/domain';

/**
 * Read-side analytics over the append-only event log. Every count and rate in
 * this module is *derived* from the log at read time — nothing is independently
 * mutable — so the funnel numbers always reproduce exactly from the events.
 *
 * The metric definitions follow directive.md §14. Denominators are never
 * swapped: each rate uses the exact stage above it in the funnel, and the
 * wallet family is measured separately and can never move these numbers.
 */

export function distinctParticipants(events: readonly DomainEvent[], type: EventType): ParticipantId[] {
  const seen = new Set<ParticipantId>();
  const ids: ParticipantId[] = [];
  for (const e of events) {
    if (e.type === type && e.participantId) {
      if (!seen.has(e.participantId)) {
        seen.add(e.participantId);
        ids.push(e.participantId);
      }
    }
  }
  return ids;
}

export interface Rate {
  numerator: number;
  denominator: number;
  /** numerator / denominator, or 0 when the denominator is empty. */
  value: number;
}

function rateOf(numerator: number, denominator: number): Rate {
  return { numerator, denominator, value: denominator === 0 ? 0 : numerator / denominator };
}

/** The seven funnel metrics from directive.md §14, each with raw counts + rate. */
export interface FunnelMetrics {
  acquisitionEntries: number;
  waitlistParticipants: number;
  disclosureViewers: number;
  reviewSubmissions: number;
  qualifiedReviews: number;
  eligibleParticipants: number;
  followUpsCreated: number;
  qualifiedReviewsWithFollowUp: number;
  acknowledgementAttempts: number;
  acknowledgementSucceeded: number;
  /** Waitlist Activation = Waitlist Joins / Acquisition Entries */
  waitlistActivation: Rate;
  /** Disclosure Engagement = Disclosure Viewers / Waitlist Participants */
  disclosureEngagement: Rate;
  /** Review Submission = Submitted Reviews / Disclosure Viewers */
  reviewSubmission: Rate;
  /** Review Qualification = Qualified Reviews / Submitted Reviews */
  reviewQualification: Rate;
  /** Qualified Participation = Qualified Reviews / Eligible Participants */
  qualifiedParticipation: Rate;
  /** Business Follow-up Conversion = Qualified Reviews With Follow-up / Qualified Reviews */
  businessFollowUpConversion: Rate;
  /** Acknowledgement Success = Successful Acknowledgements / Acknowledgement Attempts */
  acknowledgementSuccess: Rate;
}

export function computeFunnelMetrics(events: readonly DomainEvent[]): FunnelMetrics {
  const acquisitions = distinctParticipants(events, 'AcquisitionVisited');
  const waitlisted = distinctParticipants(events, 'WaitlistRegistered');
  const viewers = distinctParticipants(events, 'DisclosureViewed');
  const submissions = distinctParticipants(events, 'ReviewSubmitted');
  const qualified = distinctParticipants(events, 'ReviewQualified');

  // A participant's eligibility is minted once at acquisition, so eligible
  // participants = distinct acquired participants carrying eligibility='eligible'.
  const eligible = projectParticipants(events).filter((p) => p.eligibility === 'eligible').length;

  // Follow-ups are command-guarded to qualified reviews only, so a follow-up's
  // review is always a qualified review; the set is exact by construction.
  const qualifiedReviewIds = new Set(
    events
      .filter((e): e is Extract<DomainEvent, { type: 'ReviewQualified' }> => e.type === 'ReviewQualified')
      .map((e) => e.reviewId),
  );
  const followUps = events.filter((e) => e.type === 'BusinessFollowUpCreated');
  const reviewsWithFollowUp = new Set(followUps.map((f) => f.reviewId));
  // Directive §14 numerator: distinct *qualified* reviews touched by >=1 follow-up
  // (multiple follow-ups on one review convert once). Follow-ups are command-guarded
  // to qualified reviews, so this equals reviewsWithFollowUp.size by construction —
  // but we filter explicitly so the displayed stat and the conversion rate share one
  // definition and can never drift apart.
  const qualifiedReviewsWithFollowUp = [...reviewsWithFollowUp].filter((reviewId) =>
    qualifiedReviewIds.has(reviewId),
  ).length;

  const attempts = events.filter((e) => e.type === 'WalletAcknowledgementAttempted').length;
  const succeeded = events.filter((e) => e.type === 'WalletAcknowledgementSucceeded').length;

  return {
    acquisitionEntries: acquisitions.length,
    waitlistParticipants: waitlisted.length,
    disclosureViewers: viewers.length,
    reviewSubmissions: submissions.length,
    qualifiedReviews: qualified.length,
    eligibleParticipants: eligible,
    followUpsCreated: followUps.length,
    qualifiedReviewsWithFollowUp,
    acknowledgementAttempts: attempts,
    acknowledgementSucceeded: succeeded,
    waitlistActivation: rateOf(waitlisted.length, acquisitions.length),
    disclosureEngagement: rateOf(viewers.length, waitlisted.length),
    reviewSubmission: rateOf(submissions.length, viewers.length),
    reviewQualification: rateOf(qualified.length, submissions.length),
    qualifiedParticipation: rateOf(qualified.length, eligible),
    businessFollowUpConversion: rateOf(qualifiedReviewsWithFollowUp, qualified.length),
    acknowledgementSuccess: rateOf(succeeded, attempts),
  };
}

/** Per-channel funnel counts for the acquisition/attribution view. */
export interface ChannelSummary {
  channel: Channel;
  acquisitions: number;
  waitlistParticipants: number;
  disclosureViewers: number;
  reviewSubmissions: number;
  qualified: number;
  duplicates: number;
  abuseFlagged: number;
}

export function computeChannelSummary(events: readonly DomainEvent[]): ChannelSummary[] {
  const rows: ChannelSummary[] = [];
  for (const channel of CHANNELS) {
    rows.push({
      channel,
      acquisitions: distinctParticipants(events, 'AcquisitionVisited').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      waitlistParticipants: distinctParticipants(events, 'WaitlistRegistered').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      disclosureViewers: distinctParticipants(events, 'DisclosureViewed').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      reviewSubmissions: distinctParticipants(events, 'ReviewSubmitted').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      qualified: distinctParticipants(events, 'ReviewQualified').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      duplicates: distinctParticipants(events, 'ReviewFlaggedDuplicate').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
      abuseFlagged: distinctParticipants(events, 'ReviewFlaggedAbuse').filter(
        (id) => participantChannel(events, id) === channel,
      ).length,
    });
  }
  return rows;
}

function participantChannel(events: readonly DomainEvent[], id: ParticipantId): Channel | undefined {
  return events.find((e) => e.type === 'AcquisitionVisited' && e.participantId === id)?.channel;
}

function participantEligibility(events: readonly DomainEvent[], id: ParticipantId): 'eligible' | 'ineligible' | undefined {
  const event = events.find(
    (e): e is Extract<DomainEvent, { type: 'AcquisitionVisited' }> =>
      e.type === 'AcquisitionVisited' && e.participantId === id,
  );
  return event?.eligibility;
}

function projectParticipants(events: readonly DomainEvent[]): Array<{ id: ParticipantId; channel: Channel; eligibility: 'eligible' | 'ineligible' }> {
  const ids = distinctParticipants(events, 'AcquisitionVisited');
  const out: Array<{ id: ParticipantId; channel: Channel; eligibility: 'eligible' | 'ineligible' }> = [];
  for (const id of ids) {
    const channel = participantChannel(events, id);
    const eligibility = participantEligibility(events, id);
    if (channel && eligibility) out.push({ id, channel, eligibility });
  }
  return out;
}

/** Integrity (abuse/duplicate) counters for the operations view. */
export interface IntegritySummary {
  duplicatesFlagged: number;
  abuseFlagged: number;
  duplicateParticipants: ParticipantId[];
  abuseParticipants: ParticipantId[];
}

export function computeIntegritySummary(events: readonly DomainEvent[]): IntegritySummary {
  return {
    duplicatesFlagged: events.filter((e) => e.type === 'ReviewFlaggedDuplicate').length,
    abuseFlagged: events.filter((e) => e.type === 'ReviewFlaggedAbuse').length,
    duplicateParticipants: distinctParticipants(events, 'ReviewFlaggedDuplicate'),
    abuseParticipants: distinctParticipants(events, 'ReviewFlaggedAbuse'),
  };
}

/** Wallet acknowledgement summary — deliberately separate from the funnel. */
export interface WalletSummary {
  statuses: Record<WalletAckStatus, number>;
  successful: number;
  attempts: number;
}

export function computeWalletSummary(events: readonly DomainEvent[]): WalletSummary {
  const perParticipant = new Map<ParticipantId, WalletAckStatus>();
  for (const id of distinctParticipants(events, 'AcquisitionVisited')) {
    perParticipant.set(id, deriveWalletStatus(events.filter((e) => e.participantId === id)));
  }
  const statuses: Record<WalletAckStatus, number> = {
    not_attempted: 0,
    declined: 0,
    pending: 0,
    success: 0,
    failed: 0,
  };
  for (const status of perParticipant.values()) {
    statuses[status] += 1;
  }
  return {
    statuses,
    successful: statuses.success,
    attempts: statuses.pending + statuses.success + statuses.failed,
  };
}

/**
 * One row per synthetic participant for the operations table. Everything here
 * is derived from the participant's own events, so the CSV export and the
 * dashboard can never disagree.
 */
export interface ParticipantRow {
  id: ParticipantId;
  channel: Channel;
  eligibility: 'eligible' | 'ineligible';
  abuseProfile: 'clean' | 'synthetic_bot';
  status: ReturnType<typeof deriveStatus> | undefined;
  reviewDisposition: ReviewDisposition | undefined;
  rejectionReason: RejectionReason | undefined;
  duplicateOfReviewId: string | undefined;
  reviewId: string | undefined;
  reviewSection: string | undefined;
  walletAckStatus: WalletAckStatus;
  followUpCount: number;
}

export function buildParticipantRows(events: readonly DomainEvent[]): ParticipantRow[] {
  const rows: ParticipantRow[] = [];
  for (const id of distinctParticipants(events, 'AcquisitionVisited')) {
    const own = events.filter((e) => e.participantId === id);
    const participant = projectParticipant(own);
    if (!participant) continue;
    rows.push({
      id: participant.id,
      channel: participant.channel,
      eligibility: participant.eligibility,
      abuseProfile: participant.abuseProfile,
      status: deriveStatus(own),
      reviewDisposition: reviewDisposition(own),
      rejectionReason: rejectionReason(own),
      duplicateOfReviewId: duplicateOfReviewId(own),
      reviewId: own.find((e) => e.type === 'ReviewSubmitted')?.reviewId,
      reviewSection: own.find((e) => e.type === 'ReviewSubmitted')?.content.section,
      walletAckStatus: deriveWalletStatus(own),
      followUpCount: own.filter((e) => e.type === 'BusinessFollowUpCreated').length,
    });
  }
  // Stable ordering for tables and the CSV export.
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

function reviewDisposition(events: readonly DomainEvent[]): ReviewDisposition | undefined {
  if (events.some((e) => e.type === 'ReviewQualified')) return 'qualified';
  if (events.some((e) => e.type === 'ReviewFlaggedDuplicate')) return 'duplicate';
  if (events.some((e) => e.type === 'ReviewFlaggedAbuse')) return 'abuse_flagged';
  if (events.some((e) => e.type === 'ReviewRejected')) return 'rejected';
  return undefined;
}

function rejectionReason(events: readonly DomainEvent[]): RejectionReason | undefined {
  return events.find((e) => e.type === 'ReviewRejected')?.reason;
}

function duplicateOfReviewId(events: readonly DomainEvent[]): string | undefined {
  return events.find((e) => e.type === 'ReviewFlaggedDuplicate')?.duplicateOfReviewId;
}

/** Everything the operations dashboard renders, in one derived snapshot. */
export interface DashboardSnapshot {
  funnel: FunnelMetrics;
  channels: ChannelSummary[];
  integrity: IntegritySummary;
  wallet: WalletSummary;
  participants: ParticipantRow[];
}

export function computeDashboard(events: readonly DomainEvent[]): DashboardSnapshot {
  return {
    funnel: computeFunnelMetrics(events),
    channels: computeChannelSummary(events),
    integrity: computeIntegritySummary(events),
    wallet: computeWalletSummary(events),
    participants: buildParticipantRows(events),
  };
}