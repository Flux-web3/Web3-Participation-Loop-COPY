import { describe, it, expect } from 'vitest';
import { createInMemoryEventStore } from '@/data';
import {
  STATUS_RANK,
  deriveStatus,
  deriveWalletStatus,
  latestDisclosureView,
  projectParticipant,
} from '@/domain';
import type { ReviewContent } from '@/domain';

/**
 * Lifecycle is a pure projection over a participant's events. These tests build
 * event streams through the store (so they are correctly typed and sequenced)
 * and assert the derived status, participant entity, latest view, and — crucially
 * — that the wallet side-channel projection is completely independent of the
 * qualification lifecycle.
 */

const CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'How is the treasury custody arrangement structured across independent signers and cold storage?',
  whyItMatters: 'The disclosure names a multisig but omits signer independence, which materially affects custody risk.',
};

function acquired(id = 'U001', eligibility: 'eligible' | 'ineligible' = 'eligible', abuse: 'clean' | 'synthetic_bot' = 'clean') {
  const store = createInMemoryEventStore();
  store.append({
    type: 'AcquisitionVisited',
    occurredAt: 't',
    participantId: id,
    channel: 'referral',
    eligibility,
    abuseProfile: abuse,
  });
  return store;
}

describe('deriveStatus', () => {
  it('returns undefined for an unknown participant (no acquisition)', () => {
    expect(deriveStatus([])).toBeUndefined();
  });

  it('advances acquired -> waitlisted -> disclosure_viewed -> review_submitted -> qualified', () => {
    const store = acquired();
    expect(deriveStatus(store.all())).toBe('acquired');

    store.append({ type: 'WaitlistRegistered', occurredAt: 't', participantId: 'U001', channel: 'referral' });
    expect(deriveStatus(store.all())).toBe('waitlisted');

    store.append({
      type: 'DisclosureViewed',
      occurredAt: 't',
      participantId: 'U001',
      disclosureId: 'DISC-MUST-1',
      disclosureVersion: 2,
      sectionsSeen: ['treasury'],
    });
    expect(deriveStatus(store.all())).toBe('disclosure_viewed');

    store.append({
      type: 'ReviewSubmitted',
      occurredAt: 't',
      participantId: 'U001',
      reviewId: 'R-U001-1',
      disclosureId: 'DISC-MUST-1',
      disclosureVersion: 2,
      content: CONTENT,
      contentHash: 'h',
      wordCount: 20,
    });
    expect(deriveStatus(store.all())).toBe('review_submitted');

    store.append({ type: 'ReviewQualified', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1' });
    expect(deriveStatus(store.all())).toBe('qualified');
  });

  it('moves to disqualified on rejection, duplicate, or abuse', () => {
    const rejected = acquired('U001');
    rejected.append({ type: 'ReviewRejected', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1', reason: 'non_substantive' });
    expect(deriveStatus(rejected.all())).toBe('disqualified');

    const dup = acquired('U002');
    dup.append({ type: 'ReviewFlaggedDuplicate', occurredAt: 't', participantId: 'U002', reviewId: 'R-U002-1', duplicateOfReviewId: 'R-U001-1' });
    expect(deriveStatus(dup.all())).toBe('disqualified');

    const abuse = acquired('U003');
    abuse.append({ type: 'ReviewFlaggedAbuse', occurredAt: 't', participantId: 'U003', reviewId: 'R-U003-1', signals: ['synthetic_bot_profile'] });
    expect(deriveStatus(abuse.all())).toBe('disqualified');
  });

  it('is inert to evaluated, follow-up, and every wallet event', () => {
    const store = acquired();
    store.append({ type: 'ReviewQualified', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1' });
    store.append({ type: 'ReviewEvaluated', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1', disposition: 'qualified', checks: [] });
    store.append({ type: 'BusinessFollowUpCreated', occurredAt: 't', participantId: 'U001', followUpId: 'F-U001-1', reviewId: 'R-U001-1', followUpType: 'intro_call', actor: 'operations' });
    store.append({ type: 'WalletPrompted', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1' });
    store.append({ type: 'WalletConnected', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1' });
    store.append({ type: 'WalletAcknowledgementFailed', occurredAt: 't', participantId: 'U001', acknowledgementId: 'ACK-U001-1', errorCode: 'SIM_TX_FAILED' });
    // None of the above advance or regress the lifecycle.
    expect(deriveStatus(store.all())).toBe('qualified');
  });
});

describe('projectParticipant', () => {
  it('projects identity, synthetic attributes, and status', () => {
    const store = acquired('U007', 'ineligible', 'clean');
    expect(projectParticipant(store.all())).toEqual({
      id: 'U007',
      channel: 'referral',
      eligibility: 'ineligible',
      abuseProfile: 'clean',
      status: 'acquired',
    });
  });

  it('returns undefined without an acquisition event', () => {
    expect(projectParticipant([])).toBeUndefined();
  });
});

describe('latestDisclosureView', () => {
  it('returns the most recent recorded view', () => {
    const store = acquired();
    store.append({ type: 'DisclosureViewed', occurredAt: 't', participantId: 'U001', disclosureId: 'DISC-MUST-1', disclosureVersion: 2, sectionsSeen: ['treasury'] });
    store.append({ type: 'DisclosureViewed', occurredAt: 't', participantId: 'U001', disclosureId: 'DISC-MUST-1', disclosureVersion: 2, sectionsSeen: ['treasury', 'risk_factors'] });
    expect(latestDisclosureView(store.all())?.sectionsSeen).toEqual(['treasury', 'risk_factors']);
  });

  it('returns undefined when never viewed', () => {
    expect(latestDisclosureView([])).toBeUndefined();
  });
});

describe('deriveWalletStatus (orthogonal side-channel)', () => {
  it('stays not_attempted after only prompt + connect', () => {
    const store = acquired();
    store.append({ type: 'WalletPrompted', occurredAt: 't', participantId: 'U001' });
    store.append({ type: 'WalletConnected', occurredAt: 't', participantId: 'U001' });
    expect(deriveWalletStatus(store.all())).toBe('not_attempted');
  });

  it('reports declined / pending / success / failed from the wallet events', () => {
    const declined = acquired('U001');
    declined.append({ type: 'WalletConnectionDeclined', occurredAt: 't', participantId: 'U001' });
    expect(deriveWalletStatus(declined.all())).toBe('declined');

    const pending = acquired('U002');
    pending.append({ type: 'WalletAcknowledgementAttempted', occurredAt: 't', participantId: 'U002', acknowledgementId: 'ACK-U002-1' });
    expect(deriveWalletStatus(pending.all())).toBe('pending');

    const success = acquired('U003');
    success.append({ type: 'WalletAcknowledgementAttempted', occurredAt: 't', participantId: 'U003', acknowledgementId: 'ACK-U003-1' });
    success.append({ type: 'WalletAcknowledgementSucceeded', occurredAt: 't', participantId: 'U003', acknowledgementId: 'ACK-U003-1', simulatedRef: 'SIM-ACK-001' });
    expect(deriveWalletStatus(success.all())).toBe('success');

    const failed = acquired('U004');
    failed.append({ type: 'WalletAcknowledgementAttempted', occurredAt: 't', participantId: 'U004', acknowledgementId: 'ACK-U004-1' });
    failed.append({ type: 'WalletAcknowledgementFailed', occurredAt: 't', participantId: 'U004', acknowledgementId: 'ACK-U004-1', errorCode: 'SIM_TX_FAILED' });
    expect(deriveWalletStatus(failed.all())).toBe('failed');
  });

  it('is independent of lifecycle status: a qualified participant with a failed ack stays qualified', () => {
    const store = acquired();
    store.append({ type: 'ReviewQualified', occurredAt: 't', participantId: 'U001', reviewId: 'R-U001-1' });
    store.append({ type: 'WalletAcknowledgementFailed', occurredAt: 't', participantId: 'U001', acknowledgementId: 'ACK-U001-1', errorCode: 'SIM_TX_FAILED' });
    expect(deriveStatus(store.all())).toBe('qualified');
    expect(deriveWalletStatus(store.all())).toBe('failed');
  });
});

describe('STATUS_RANK', () => {
  it('treats qualified and disqualified as the (equal, highest) terminal ranks', () => {
    expect(STATUS_RANK.qualified).toBe(STATUS_RANK.disqualified);
    expect(STATUS_RANK.acquired).toBeLessThan(STATUS_RANK.waitlisted);
    expect(STATUS_RANK.waitlisted).toBeLessThan(STATUS_RANK.disclosure_viewed);
    expect(STATUS_RANK.disclosure_viewed).toBeLessThan(STATUS_RANK.review_submitted);
    expect(STATUS_RANK.review_submitted).toBeLessThan(STATUS_RANK.qualified);
  });
});
