import { describe, it, expect } from 'vitest';
import { DISCLOSURE, createInMemoryEventStore } from '@/data';
import {
  CommandError,
  acceptAcquisition,
  attemptAcknowledgement,
  connectWallet,
  createContext,
  createFollowUp,
  declineWallet,
  promptWallet,
  registerWaitlist,
  submitReview,
  viewDisclosure,
} from '@/commands';
import type { CommandContext, CommandErrorCode } from '@/commands';
import { deriveWalletStatus, projectParticipant } from '@/domain';
import type { ReviewContent } from '@/domain';

/**
 * End-to-end command-layer tests over the canonical journey:
 *
 *   acquisition -> waitlist -> disclosure -> review -> qualification
 *   then two INDEPENDENT branches: business follow-up, optional wallet ack.
 *
 * These assert the guards, the qualification dispositions (qualified / rejected /
 * duplicate / abuse), first-writer-wins duplicate detection across participants,
 * deterministic ids + sequencing, and the central product claim: wallet activity
 * is measured separately and never affects qualification or conversion.
 */

const ALL_SECTIONS = DISCLOSURE.sections.map((s) => s.id);

function ctx(): CommandContext {
  return createContext(createInMemoryEventStore(), DISCLOSURE, () => '2026-02-01T00:00:00.000Z');
}

/** A distinct, gate-passing review keyed by `seed` (unique unless shared). */
function contentFor(seed: string): ReviewContent {
  return {
    section: 'treasury',
    question: `How is the treasury custody arrangement structured for scenario ${seed} across independent signers and storage?`,
    whyItMatters: `The disclosure omits signer independence detail relevant to ${seed}, which materially affects custody risk assessment here.`,
  };
}

interface QualifyOpts {
  eligibility?: 'eligible' | 'ineligible';
  abuseProfile?: 'clean' | 'synthetic_bot';
  content?: ReviewContent;
}

/** Drive a participant all the way to a submitted review; return the result. */
function runToReview(c: CommandContext, id: string, opts: QualifyOpts = {}) {
  acceptAcquisition(c, {
    participantId: id,
    channel: 'direct',
    eligibility: opts.eligibility ?? 'eligible',
    abuseProfile: opts.abuseProfile ?? 'clean',
  });
  registerWaitlist(c, { participantId: id });
  viewDisclosure(c, { participantId: id, sectionsSeen: ALL_SECTIONS });
  return submitReview(c, { participantId: id, content: opts.content ?? contentFor(id) });
}

function statusOf(c: CommandContext, id: string) {
  return projectParticipant(c.store.byParticipant(id))?.status;
}

function expectCode(fn: () => unknown, code: CommandErrorCode) {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(CommandError);
  expect((err as CommandError).code).toBe(code);
}

describe('canonical journey', () => {
  it('runs acquisition -> waitlist -> disclosure -> qualified review', () => {
    const c = ctx();
    expect(acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' }).status).toBe('acquired');
    expect(registerWaitlist(c, { participantId: 'U001' }).status).toBe('waitlisted');
    expect(viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS }).status).toBe('disclosure_viewed');

    const r = submitReview(c, { participantId: 'U001', content: contentFor('U001') });
    expect(r.result.disposition).toBe('qualified');
    expect(r.reviewId).toBe('R-U001-1');
    expect(r.events.map((e) => e.type)).toEqual(['ReviewSubmitted', 'ReviewEvaluated', 'ReviewQualified']);
    expect(statusOf(c, 'U001')).toBe('qualified');
  });

  it('appends events in canonical order with a gapless sequence', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('seq') });
    createFollowUp(c, { participantId: 'U001', followUpType: 'intro_call', actor: 'operations' });
    promptWallet(c, { participantId: 'U001' });
    connectWallet(c, { participantId: 'U001' });
    attemptAcknowledgement(c, { participantId: 'U001', outcome: 'success' });

    expect(c.store.all().map((e) => e.type)).toEqual([
      'AcquisitionVisited',
      'WaitlistRegistered',
      'DisclosureViewed',
      'ReviewSubmitted',
      'ReviewEvaluated',
      'ReviewQualified',
      'BusinessFollowUpCreated',
      'WalletPrompted',
      'WalletConnected',
      'WalletAcknowledgementAttempted',
      'WalletAcknowledgementSucceeded',
    ]);
    expect(c.store.all().map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('command guards', () => {
  it('rejects a duplicate acquisition', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    expectCode(() => acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' }), 'participant_exists');
  });

  it('throws participant_not_found for an unknown participant', () => {
    expectCode(() => registerWaitlist(ctx(), { participantId: 'ZZZ' }), 'participant_not_found');
  });

  it('registerWaitlist requires acquired status', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    expectCode(() => registerWaitlist(c, { participantId: 'U001' }), 'invalid_state');
  });

  it('viewDisclosure requires waitlisted (or a prior view) status', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    expectCode(() => viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS }), 'invalid_state');
  });

  it('allows re-viewing the disclosure', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    viewDisclosure(c, { participantId: 'U001', sectionsSeen: ['treasury'] });
    expect(viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS }).status).toBe('disclosure_viewed');
  });

  it('submitReview requires disclosure_viewed status', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    expectCode(() => submitReview(c, { participantId: 'U001', content: contentFor('x') }), 'invalid_state');
  });
});

describe('qualification dispositions', () => {
  it('rejects an ineligible participant and disqualifies them', () => {
    const c = ctx();
    const r = runToReview(c, 'U001', { eligibility: 'ineligible', content: contentFor('elig') });
    expect(r.result.disposition).toBe('rejected');
    expect(r.result.primaryReason).toBe('ineligible');
    expect(r.events.at(-1)?.type).toBe('ReviewRejected');
    expect(statusOf(c, 'U001')).toBe('disqualified');
  });

  it('flags a synthetic-bot submission as abuse', () => {
    const c = ctx();
    const r = runToReview(c, 'U001', { abuseProfile: 'synthetic_bot', content: contentFor('abuse') });
    expect(r.result.disposition).toBe('abuse_flagged');
    expect(r.events.at(-1)?.type).toBe('ReviewFlaggedAbuse');
    expect(statusOf(c, 'U001')).toBe('disqualified');
  });

  it('rejects a review submitted against a stale disclosure version', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS });
    const r = submitReview(c, { participantId: 'U001', content: contentFor('ver'), disclosureVersion: 1 });
    expect(r.result.disposition).toBe('rejected');
    expect(r.result.primaryReason).toBe('disclosure_version_mismatch');
    expect(statusOf(c, 'U001')).toBe('disqualified');
  });

  it('qualifies a review after the participant re-reads the current version following a stale view', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS, disclosureVersion: 1 });
    viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS });
    const r = submitReview(c, { participantId: 'U001', content: contentFor('reread'), disclosureVersion: DISCLOSURE.version });
    expect(r.result.disposition).toBe('qualified');
  });

  it('rejects a review written against the stale version the participant actually read', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    viewDisclosure(c, { participantId: 'U001', sectionsSeen: ALL_SECTIONS, disclosureVersion: 1 });
    const r = submitReview(c, { participantId: 'U001', content: contentFor('stale'), disclosureVersion: 1 });
    expect(r.result.disposition).toBe('rejected');
    expect(r.result.primaryReason).toBe('disclosure_version_mismatch');
    expect(r.result.checks.find((g) => g.gate === 'disclosure_viewed')?.note).toBe('submitted against outdated v1 (current v2)');
  });

  it('flags the second identical review as a duplicate of the first (first-writer-wins)', () => {
    const c = ctx();
    const shared = contentFor('shared');
    const first = runToReview(c, 'U001', { content: shared });
    expect(first.result.disposition).toBe('qualified');

    const second = runToReview(c, 'U002', { content: shared });
    expect(second.result.disposition).toBe('duplicate');
    expect(second.result.duplicateOfReviewId).toBe('R-U001-1');
    expect(second.events.at(-1)?.type).toBe('ReviewFlaggedDuplicate');

    expect(statusOf(c, 'U001')).toBe('qualified');
    expect(statusOf(c, 'U002')).toBe('disqualified');
  });
});

describe('business follow-up (conversion lane)', () => {
  it('creates a follow-up for a qualified participant', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('follow') });
    const f = createFollowUp(c, { participantId: 'U001', followUpType: 'intro_call', actor: 'operations' });
    expect(f.followUpId).toBe('F-U001-1');
    expect(f.reviewId).toBe('R-U001-1');
  });

  it('allows multiple follow-ups on the same qualified review', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('multi') });
    expect(createFollowUp(c, { participantId: 'U001', followUpType: 'intro_call', actor: 'operations' }).followUpId).toBe('F-U001-1');
    expect(createFollowUp(c, { participantId: 'U001', followUpType: 'diligence_request', actor: 'partner' }).followUpId).toBe('F-U001-2');
  });

  it('refuses a follow-up for a disqualified participant', () => {
    const c = ctx();
    runToReview(c, 'U001', { eligibility: 'ineligible', content: contentFor('nofollow') });
    expectCode(() => createFollowUp(c, { participantId: 'U001', followUpType: 'intro_call', actor: 'operations' }), 'not_qualified');
  });
});

describe('optional wallet acknowledgement (orthogonal branch)', () => {
  it('records a successful acknowledgement without changing lifecycle status', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('wsucc') });
    promptWallet(c, { participantId: 'U001' });
    connectWallet(c, { participantId: 'U001' });
    const ack = attemptAcknowledgement(c, { participantId: 'U001', outcome: 'success' });
    expect(ack.status).toBe('success');
    expect(ack.acknowledgementId).toBe('ACK-U001-1');
    expect(deriveWalletStatus(c.store.byParticipant('U001'))).toBe('success');
    expect(statusOf(c, 'U001')).toBe('qualified');
  });

  it('records a failed acknowledgement without affecting qualification', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('wfail') });
    promptWallet(c, { participantId: 'U001' });
    connectWallet(c, { participantId: 'U001' });
    const ack = attemptAcknowledgement(c, { participantId: 'U001', outcome: 'failure' });
    expect(ack.status).toBe('failed');
    expect(deriveWalletStatus(c.store.byParticipant('U001'))).toBe('failed');
    expect(statusOf(c, 'U001')).toBe('qualified');
  });

  it('a declined wallet leaves the participant qualified and still convertible', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('wdecl') });
    promptWallet(c, { participantId: 'U001' });
    declineWallet(c, { participantId: 'U001' });
    expect(deriveWalletStatus(c.store.byParticipant('U001'))).toBe('declined');
    expect(statusOf(c, 'U001')).toBe('qualified');
    // Conversion is unaffected by declining the optional acknowledgement.
    expect(createFollowUp(c, { participantId: 'U001', followUpType: 'intro_call', actor: 'operations' }).followUpId).toBe('F-U001-1');
  });

  it('requires a qualified participant to prompt the wallet', () => {
    const c = ctx();
    acceptAcquisition(c, { participantId: 'U001', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    registerWaitlist(c, { participantId: 'U001' });
    expectCode(() => promptWallet(c, { participantId: 'U001' }), 'not_qualified');
  });

  it('cannot prompt the same participant twice', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('twice') });
    promptWallet(c, { participantId: 'U001' });
    expectCode(() => promptWallet(c, { participantId: 'U001' }), 'already_prompted');
  });

  it('cannot decline before being prompted', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('nodecl') });
    expectCode(() => declineWallet(c, { participantId: 'U001' }), 'wallet_not_prompted');
  });

  it('cannot acknowledge before connecting', () => {
    const c = ctx();
    runToReview(c, 'U001', { content: contentFor('noack') });
    promptWallet(c, { participantId: 'U001' });
    expectCode(() => attemptAcknowledgement(c, { participantId: 'U001', outcome: 'success' }), 'wallet_not_connected');
  });
});
