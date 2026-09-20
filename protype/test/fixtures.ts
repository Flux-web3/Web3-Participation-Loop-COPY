import type { DomainEvent, EventType, GateCheck, ReviewContent } from '@/domain';
import { GATE_ORDER } from '@/domain';

// One fully-typed sample of every event type. The mapped type below is the
// compile-time proof that the sample set covers the whole union exactly — if a
// new event type is added without a sample here, this file fails to typecheck.

let seq = 0;
function base<T extends EventType>(type: T, occurredAt = '2026-01-01T00:00:00.000Z') {
  seq += 1;
  return { sequence: seq, id: `evt_${seq}_${type}`, type, occurredAt };
}

const SAMPLE_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'How is the treasury custody arrangement structured across signers and cold storage?',
  whyItMatters:
    'The disclosure names a multisig but does not describe signer independence, so custody risk is unclear.',
};

const PASSING_CHECKS: GateCheck[] = GATE_ORDER.map((gate) => ({ gate, passed: true, note: 'ok' }));

export const SAMPLE_EVENTS: { [T in EventType]: Extract<DomainEvent, { type: T }> } = {
  AcquisitionVisited: {
    ...base('AcquisitionVisited'),
    participantId: 'U001',
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
  },
  WaitlistRegistered: { ...base('WaitlistRegistered'), participantId: 'U001', channel: 'direct' },
  DisclosureViewed: {
    ...base('DisclosureViewed'),
    participantId: 'U001',
    disclosureId: 'DISC-1',
    disclosureVersion: 2,
    sectionsSeen: ['treasury', 'risk_factors'],
  },
  ReviewSubmitted: {
    ...base('ReviewSubmitted'),
    participantId: 'U001',
    reviewId: 'R-U001-1',
    disclosureId: 'DISC-1',
    disclosureVersion: 2,
    content: SAMPLE_CONTENT,
    contentHash: 'hash-sample',
    wordCount: 24,
  },
  ReviewEvaluated: {
    ...base('ReviewEvaluated'),
    participantId: 'U001',
    reviewId: 'R-U001-1',
    disposition: 'qualified',
    checks: PASSING_CHECKS,
  },
  ReviewQualified: { ...base('ReviewQualified'), participantId: 'U001', reviewId: 'R-U001-1' },
  ReviewRejected: { ...base('ReviewRejected'), participantId: 'U002', reviewId: 'R-U002-1', reason: 'non_substantive' },
  ReviewFlaggedDuplicate: {
    ...base('ReviewFlaggedDuplicate'),
    participantId: 'U003',
    reviewId: 'R-U003-1',
    duplicateOfReviewId: 'R-U001-1',
  },
  ReviewFlaggedAbuse: {
    ...base('ReviewFlaggedAbuse'),
    participantId: 'U004',
    reviewId: 'R-U004-1',
    signals: ['synthetic_bot_profile'],
  },
  BusinessFollowUpCreated: {
    ...base('BusinessFollowUpCreated'),
    participantId: 'U001',
    followUpId: 'F-1',
    reviewId: 'R-U001-1',
    followUpType: 'intro_call',
    actor: 'operations',
  },
  WalletPrompted: { ...base('WalletPrompted'), participantId: 'U001', reviewId: 'R-U001-1' },
  WalletConnectionDeclined: { ...base('WalletConnectionDeclined'), participantId: 'U001', reviewId: 'R-U001-1' },
  WalletConnected: { ...base('WalletConnected'), participantId: 'U001', reviewId: 'R-U001-1' },
  WalletAcknowledgementAttempted: {
    ...base('WalletAcknowledgementAttempted'),
    participantId: 'U001',
    acknowledgementId: 'ACK-1',
    reviewId: 'R-U001-1',
  },
  WalletAcknowledgementSucceeded: {
    ...base('WalletAcknowledgementSucceeded'),
    participantId: 'U001',
    acknowledgementId: 'ACK-1',
    simulatedRef: 'SIM-ACK-001',
  },
  WalletAcknowledgementFailed: {
    ...base('WalletAcknowledgementFailed'),
    participantId: 'U005',
    acknowledgementId: 'ACK-2',
    errorCode: 'SIM_USER_REJECTED',
  },
};

export const ALL_SAMPLE_EVENTS: DomainEvent[] = Object.values(SAMPLE_EVENTS);
