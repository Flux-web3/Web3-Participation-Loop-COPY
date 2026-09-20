import { describe, it, expect } from 'vitest';
import { createInMemoryEventStore } from '@/data';
import {
  buildParticipantRows,
  computeChannelSummary,
  computeDashboard,
  computeFunnelMetrics,
  computeIntegritySummary,
  computeWalletSummary,
  distinctParticipants,
} from '@/analytics';
import { buildSyntheticStore } from '@/seed';

/**
 * The analytics layer is a pure read-side projection over the append-only log.
 * These tests lock in: (1) the exact funnel numbers of the synthetic dataset
 * (against the denominators fixed in directive.md §14), (2) that wallet events
 * can never move funnel metrics, (3) channel/integrity/wallet breakdowns, and
 * (4) the participant rows used by the CSV export and the dashboard.
 */

describe('computeFunnelMetrics on the synthetic dataset', () => {
  const metrics = computeFunnelMetrics(buildSyntheticStore().all());

  it('reports raw funnel counts exactly', () => {
    expect(metrics.acquisitionEntries).toBe(20);
    expect(metrics.waitlistParticipants).toBe(18);
    expect(metrics.disclosureViewers).toBe(16);
    expect(metrics.reviewSubmissions).toBe(14);
    expect(metrics.qualifiedReviews).toBe(7);
    expect(metrics.eligibleParticipants).toBe(19);
    expect(metrics.followUpsCreated).toBe(3);
    expect(metrics.qualifiedReviewsWithFollowUp).toBe(3);
    expect(metrics.acknowledgementAttempts).toBe(4);
    expect(metrics.acknowledgementSucceeded).toBe(2);
  });

  it('computes every rate with the directive-given denominator', () => {
    expect(metrics.waitlistActivation).toEqual({ numerator: 18, denominator: 20, value: 0.9 });
    expect(metrics.disclosureEngagement).toEqual({ numerator: 16, denominator: 18, value: 16 / 18 });
    expect(metrics.reviewSubmission).toEqual({ numerator: 14, denominator: 16, value: 14 / 16 });
    expect(metrics.reviewQualification).toEqual({ numerator: 7, denominator: 14, value: 7 / 14 });
    expect(metrics.qualifiedParticipation).toEqual({ numerator: 7, denominator: 19, value: 7 / 19 });
    expect(metrics.businessFollowUpConversion).toEqual({ numerator: 3, denominator: 7, value: 3 / 7 });
    expect(metrics.acknowledgementSuccess).toEqual({ numerator: 2, denominator: 4, value: 0.5 });
  });

  it('yields zero rates on an empty log without throwing', () => {
    const empty = computeFunnelMetrics([]);
    expect(empty.waitlistActivation.value).toBe(0);
    expect(empty.acknowledgementSuccess.value).toBe(0);
    expect(empty.acquisitionEntries).toBe(0);
  });
});

describe('wallet-event independence', () => {
  it('keeps every funnel metric identical when wallet events are added', () => {
    const store = buildSyntheticStore();
    const before = computeFunnelMetrics(store.all());

    // U009 was qualified with no wallet at all; give it a full declined flow.
    store.appendMany([
      { type: 'WalletPrompted', occurredAt: 't', participantId: 'U009' },
      { type: 'WalletConnectionDeclined', occurredAt: 't', participantId: 'U009' },
    ]);
    const after = computeFunnelMetrics(store.all());

    expect(after.acquisitionEntries).toBe(before.acquisitionEntries);
    expect(after.qualifiedReviews).toBe(before.qualifiedReviews);
    expect(after.businessFollowUpConversion).toEqual(before.businessFollowUpConversion);
    expect(after.reviewQualification).toEqual(before.reviewQualification);
    expect(after.qualifiedParticipation).toEqual(before.qualifiedParticipation);
  });

  it('tracks those wallet events in the wallet summary instead', () => {
    const store = buildSyntheticStore();
    store.appendMany([
      { type: 'WalletPrompted', occurredAt: 't', participantId: 'U009' },
      { type: 'WalletConnectionDeclined', occurredAt: 't', participantId: 'U009' },
    ]);
    const summary = computeWalletSummary(store.all());
    expect(summary.statuses.declined).toBe(3); // U008, U012, U009
    expect(summary.statuses.success).toBe(2);
    expect(summary.statuses.failed).toBe(2);
  });
});

describe('computeChannelSummary', () => {
  it('covers all seven channels with the seeded counts', () => {
    const rows = computeChannelSummary(buildSyntheticStore().all());
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r]));
    expect(rows.map((r) => r.channel)).toEqual([
      'direct',
      'referral',
      'campaign',
      'community',
      'partner',
      'social',
      'other',
    ]);
    expect(byChannel.campaign.acquisitions).toBe(4);
    expect(byChannel.campaign.qualified).toBe(2);
    expect(byChannel.social.acquisitions).toBe(4);
    expect(byChannel.social.qualified).toBe(1);
    expect(byChannel.community.acquisitions).toBe(3);
    expect(byChannel.community.qualified).toBe(1);
    expect(byChannel.direct.qualified).toBe(2);
    expect(byChannel.partner.qualified).toBe(1);
    expect(byChannel.referral.duplicates).toBe(0);
    expect(byChannel.social.abuseFlagged).toBe(1);
    expect(byChannel.community.duplicates).toBe(0);
  });
});

describe('computeIntegritySummary', () => {
  it('counts the seeded duplicate and abuse participants', () => {
    const integrity = computeIntegritySummary(buildSyntheticStore().all());
    expect(integrity.duplicatesFlagged).toBe(1);
    expect(integrity.abuseFlagged).toBe(1);
    expect(integrity.duplicateParticipants).toEqual(['U013']);
    expect(integrity.abuseParticipants).toEqual(['U014']);
  });
});

describe('buildParticipantRows', () => {
  const rows = buildParticipantRows(buildSyntheticStore().all());

  it('projects every participant with derived disposition', () => {
    expect(rows).toHaveLength(20);
    const u001 = rows.find((r) => r.id === 'U001');
    expect(u001?.status).toBe('acquired');
    expect(u001?.reviewDisposition).toBeUndefined();

    const u007 = rows.find((r) => r.id === 'U007');
    expect(u007?.status).toBe('qualified');
    expect(u007?.reviewDisposition).toBe('qualified');
    expect(u007?.walletAckStatus).toBe('success');
    expect(u007?.followUpCount).toBe(1);

    const u009 = rows.find((r) => r.id === 'U009');
    expect(u009?.reviewDisposition).toBe('qualified');
    expect(u009?.walletAckStatus).toBe('not_attempted');
  });

  it('derives duplicate targets and each rejection reason', () => {
    const u013 = rows.find((r) => r.id === 'U013');
    expect(u013?.reviewDisposition).toBe('duplicate');
    expect(u013?.duplicateOfReviewId).toBe('R-U007-1');

    const u015 = rows.find((r) => r.id === 'U015');
    expect(u015?.reviewDisposition).toBe('rejected');
    expect(u015?.rejectionReason).toBe('ineligible');

    const u016 = rows.find((r) => r.id === 'U016');
    expect(u016?.rejectionReason).toBe('non_substantive');

    const u017 = rows.find((r) => r.id === 'U017');
    expect(u017?.rejectionReason).toBe('disclosure_version_mismatch');

    const u018 = rows.find((r) => r.id === 'U018');
    expect(u018?.rejectionReason).toBe('incomplete');

    const u019 = rows.find((r) => r.id === 'U019');
    expect(u019?.rejectionReason).toBe('no_section_reference');

    const u014 = rows.find((r) => r.id === 'U014');
    expect(u014?.reviewDisposition).toBe('abuse_flagged');
  });
});

describe('distinctParticipants', () => {
  it('counts each participant once per event type', () => {
    const store = createInMemoryEventStore();
    store.append({ type: 'AcquisitionVisited', occurredAt: 't', participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    store.append({ type: 'AcquisitionVisited', occurredAt: 't', participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    store.append({ type: 'AcquisitionVisited', occurredAt: 't', participantId: 'U002', channel: 'social', eligibility: 'eligible', abuseProfile: 'clean' });
    expect(distinctParticipants(store.all(), 'AcquisitionVisited')).toEqual(['U001', 'U002']);
  });
});

describe('computeDashboard', () => {
  it('bundles the full snapshot the dashboard renders', () => {
    const snapshot = computeDashboard(buildSyntheticStore().all());
    expect(snapshot.funnel.acquisitionEntries).toBe(20);
    expect(snapshot.channels).toHaveLength(7);
    expect(snapshot.integrity.duplicatesFlagged).toBe(1);
    expect(snapshot.participants).toHaveLength(20);
  });
});