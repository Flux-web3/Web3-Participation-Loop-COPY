import type { AcquisitionVisitedEvent, DomainEvent } from '../events';
import type { DisclosureView, Participant } from '../entities';
import type { ParticipantStatus, WalletAckStatus } from '../enums';

/**
 * Participant lifecycle as a pure projection over that participant's events in
 * sequence order. The canonical journey is:
 *
 *   acquired → waitlisted → disclosure_viewed → review_submitted
 *            → qualified | disqualified
 *
 * Business follow-up and the optional wallet acknowledgement are downstream of
 * `qualified` and never change lifecycle status — they are separate branches, so
 * neither can move a participant into or out of qualification.
 */

/** Canonical forward rank of each status (higher = further along). */
export const STATUS_RANK: Record<ParticipantStatus, number> = {
  acquired: 0,
  waitlisted: 1,
  disclosure_viewed: 2,
  review_submitted: 3,
  qualified: 4,
  disqualified: 4,
};

/**
 * Derive the current lifecycle status from a participant's events. Returns
 * `undefined` for an unknown participant (no AcquisitionVisited event). Wallet,
 * follow-up, and evaluation-audit events are intentionally inert here.
 */
export function deriveStatus(events: readonly DomainEvent[]): ParticipantStatus | undefined {
  let status: ParticipantStatus | undefined;
  for (const e of events) {
    switch (e.type) {
      case 'AcquisitionVisited':
        status = 'acquired';
        break;
      case 'WaitlistRegistered':
        status = 'waitlisted';
        break;
      case 'DisclosureViewed':
        status = 'disclosure_viewed';
        break;
      case 'ReviewSubmitted':
        status = 'review_submitted';
        break;
      case 'ReviewQualified':
        status = 'qualified';
        break;
      case 'ReviewRejected':
      case 'ReviewFlaggedDuplicate':
      case 'ReviewFlaggedAbuse':
        status = 'disqualified';
        break;
      default:
        // ReviewEvaluated, BusinessFollowUpCreated, and every Wallet* event do
        // not advance the participant lifecycle.
        break;
    }
  }
  return status;
}

/**
 * Project the full participant entity (identity + synthetic attributes + status)
 * from their events. Attributes are minted once at acquisition.
 */
export function projectParticipant(events: readonly DomainEvent[]): Participant | undefined {
  const acquisition = events.find(
    (e): e is AcquisitionVisitedEvent => e.type === 'AcquisitionVisited',
  );
  if (!acquisition) return undefined;
  const status = deriveStatus(events);
  if (!status) return undefined;
  return {
    id: acquisition.participantId,
    channel: acquisition.channel,
    eligibility: acquisition.eligibility,
    abuseProfile: acquisition.abuseProfile,
    status,
  };
}

/** The participant's most recent recorded disclosure view, if any. */
export function latestDisclosureView(events: readonly DomainEvent[]): DisclosureView | undefined {
  let latest: DisclosureView | undefined;
  for (const e of events) {
    if (e.type === 'DisclosureViewed') {
      latest = {
        disclosureId: e.disclosureId,
        disclosureVersion: e.disclosureVersion,
        sectionsSeen: e.sectionsSeen,
      };
    }
  }
  return latest;
}

/**
 * Derive the simulated wallet acknowledgement status from a participant's
 * events. Independent of lifecycle status by construction — reads only the
 * disjoint wallet event family, so it can never be a qualification input.
 */
export function deriveWalletStatus(events: readonly DomainEvent[]): WalletAckStatus {
  let status: WalletAckStatus = 'not_attempted';
  for (const e of events) {
    switch (e.type) {
      case 'WalletConnectionDeclined':
        status = 'declined';
        break;
      case 'WalletAcknowledgementAttempted':
        status = 'pending';
        break;
      case 'WalletAcknowledgementSucceeded':
        status = 'success';
        break;
      case 'WalletAcknowledgementFailed':
        status = 'failed';
        break;
      default:
        // WalletPrompted / WalletConnected leave status at its prior value
        // (still not_attempted until an acknowledgement is attempted).
        break;
    }
  }
  return status;
}
