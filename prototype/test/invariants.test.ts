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
import { computeFunnelMetrics, computeIntegritySummary, buildParticipantRows } from '@/analytics';
import { EVENT_FAMILY, STATUS_RANK, deriveStatus, projectParticipant } from '@/domain';
import type { DomainEvent, EventType, ReviewContent } from '@/domain';
import { buildSyntheticStore, playJourney } from '@/seed';
import { DEMO_SCENARIOS, resetLiveSession } from '@/src/journey';

/**
 * Product-invariant regression suite (QA audit). Each block names the invariant
 * it guards; together they pin the rules the dashboard and the decision memo
 * rely on: no qualification bypass, first-VALID-writer-wins duplicates, abuse
 * exclusion, wallet/follow-up independence, the follow-up guard, event-coverage
 * between commands and analytics, causal ordering, and demo-scenario outcomes.
 */

const ALL_SECTIONS = DISCLOSURE.sections.map((s) => s.id);

function ctx(): CommandContext {
  return createContext(createInMemoryEventStore(), DISCLOSURE, () => '2026-02-01T00:00:00.000Z');
}

function content(seed: string): ReviewContent {
  return {
    section: 'governance',
    question: `Which body ratifies proposals for case ${seed} and how are conflicting votes resolved in practice?`,
    whyItMatters: `The governance section omits binding authority for ${seed}, so stakeholders cannot tell who actually controls outcomes.`,
  };
}

function acquire(c: CommandContext, id: string, opts: { eligibility?: 'eligible' | 'ineligible'; abuseProfile?: 'clean' | 'synthetic_bot' } = {}) {
  acceptAcquisition(c, {
    participantId: id,
    channel: 'direct',
    eligibility: opts.eligibility ?? 'eligible',
    abuseProfile: opts.abuseProfile ?? 'clean',
  });
}

function toReview(
  c: CommandContext,
  id: string,
  body: ReviewContent,
  opts: { eligibility?: 'eligible' | 'ineligible'; abuseProfile?: 'clean' | 'synthetic_bot' } = {},
) {
  acquire(c, id, opts);
  registerWaitlist(c, { participantId: id });
  viewDisclosure(c, { participantId: id, sectionsSeen: ALL_SECTIONS });
  return submitReview(c, { participantId: id, content: body });
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

const status = (c: CommandContext, id: string) => projectParticipant(c.store.byParticipant(id))?.status;

// ---------------------------------------------------------------------------
describe('INV-1 qualification cannot be bypassed', () => {
  it('refuses a submission straight from acquisition (no waitlist, no view)', () => {
    const c = ctx();
    acquire(c, 'P1');
    expectCode(() => submitReview(c, { participantId: 'P1', content: content('p1') }), 'invalid_state');
    expect(c.store.byType('ReviewSubmitted')).toHaveLength(0);
  });

  it('refuses re-submission and re-viewing after disqualification', () => {
    const c = ctx();
    const r = toReview(c, 'P1', { section: 'treasury', question: 'Looks good.', whyItMatters: 'Nice work.' });
    expect(r.result.disposition).toBe('rejected');
    expectCode(() => submitReview(c, { participantId: 'P1', content: content('retry') }), 'invalid_state');
    expectCode(() => viewDisclosure(c, { participantId: 'P1', sectionsSeen: ALL_SECTIONS }), 'invalid_state');
    expect(c.store.byType('ReviewQualified')).toHaveLength(0);
    expect(status(c, 'P1')).toBe('disqualified');
  });

  it('refuses a second submission from an already-qualified participant (one ReviewQualified max)', () => {
    const c = ctx();
    expect(toReview(c, 'P1', content('once')).result.disposition).toBe('qualified');
    expectCode(() => submitReview(c, { participantId: 'P1', content: content('twice') }), 'invalid_state');
    expect(c.store.byType('ReviewQualified')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('INV-2 duplicates (first VALID submission wins)', () => {
  it('a duplicate of a qualified review never qualifies, adds no qualified review, and cannot convert', () => {
    const c = ctx();
    const shared = content('shared');
    toReview(c, 'P1', shared);
    createFollowUp(c, { participantId: 'P1', followUpType: 'intro_call', actor: 'operations' });
    const before = computeFunnelMetrics(c.store.all());

    const dup = toReview(c, 'P2', shared);
    expect(dup.result.disposition).toBe('duplicate');
    expect(dup.result.duplicateOfReviewId).toBe('R-P1-1');
    expectCode(() => createFollowUp(c, { participantId: 'P2', followUpType: 'intro_call', actor: 'operations' }), 'not_qualified');

    const after = computeFunnelMetrics(c.store.all());
    expect(after.qualifiedReviews).toBe(before.qualifiedReviews);
    expect(after.qualifiedReviewsWithFollowUp).toBe(1);
    expect(after.reviewSubmissions).toBe(2); // the duplicate is recorded, just excluded
    expect(status(c, 'P1')).toBe('qualified'); // the original stays qualifying
  });

  it('an earlier REJECTED holder of the hash does not block a later valid identical review', () => {
    const c = ctx();
    const shared = content('first-was-ineligible');
    expect(toReview(c, 'P1', shared, { eligibility: 'ineligible' }).result.disposition).toBe('rejected');
    const valid = toReview(c, 'P2', shared);
    expect(valid.result.disposition).toBe('qualified');
    // ...and the valid one now owns the content for any later copy.
    const third = toReview(c, 'P3', shared);
    expect(third.result.disposition).toBe('duplicate');
    expect(third.result.duplicateOfReviewId).toBe('R-P2-1');
    // History of the rejected first holder is untouched.
    expect(status(c, 'P1')).toBe('disqualified');
  });

  it('an earlier ABUSE-flagged holder of the hash does not block a later valid identical review', () => {
    const c = ctx();
    const shared = content('first-was-bot');
    expect(toReview(c, 'P1', shared, { abuseProfile: 'synthetic_bot' }).result.disposition).toBe('abuse_flagged');
    expect(toReview(c, 'P2', shared).result.disposition).toBe('qualified');
  });

  it('a repeated non-substantive text is rejected on its merits, not mislabelled duplicate', () => {
    const c = ctx();
    const junk = { section: 'overview', question: 'Looks good', whyItMatters: '' } as ReviewContent;
    expect(toReview(c, 'P1', junk).result.disposition).toBe('rejected');
    const again = toReview(c, 'P2', junk);
    expect(again.result.disposition).toBe('rejected');
    expect(again.result.primaryReason).toBe('incomplete');
  });
});

// ---------------------------------------------------------------------------
describe('INV-3 abuse-flagged reviews', () => {
  it('never qualify, are visible to ops, and are excluded from conversion and the wallet branch', () => {
    const c = ctx();
    const r = toReview(c, 'BOT', content('bot'), { abuseProfile: 'synthetic_bot' });
    expect(r.result.disposition).toBe('abuse_flagged');
    expect(r.result.qualifiesForConversion).toBe(false);
    const integrity = computeIntegritySummary(c.store.all());
    expect(integrity.abuseParticipants).toEqual(['BOT']);
    expect(computeFunnelMetrics(c.store.all()).qualifiedReviews).toBe(0);
    expectCode(() => createFollowUp(c, { participantId: 'BOT', followUpType: 'intro_call', actor: 'operations' }), 'not_qualified');
    expectCode(() => promptWallet(c, { participantId: 'BOT' }), 'not_qualified');
  });
});

// ---------------------------------------------------------------------------
describe('INV-4 wallet branch is independent of qualification and follow-up', () => {
  it('every wallet command refuses unqualified (rejected / duplicate / abuse / pre-review) participants', () => {
    const c = ctx();
    toReview(c, 'OK', content('owner'));
    toReview(c, 'REJ', content('rej'), { eligibility: 'ineligible' });
    toReview(c, 'DUP', content('owner'));
    toReview(c, 'BOT', content('bot'), { abuseProfile: 'synthetic_bot' });
    acquire(c, 'NEW');
    for (const id of ['REJ', 'DUP', 'BOT', 'NEW']) {
      expectCode(() => promptWallet(c, { participantId: id }), 'not_qualified');
      expectCode(() => declineWallet(c, { participantId: id }), 'not_qualified');
      expectCode(() => connectWallet(c, { participantId: id }), 'not_qualified');
      expectCode(() => attemptAcknowledgement(c, { participantId: id, outcome: 'success' }), 'not_qualified');
    }
    expect(c.store.all().some((e) => EVENT_FAMILY[e.type] === 'wallet')).toBe(false);
  });

  it('a failed ack records no success, keeps qualification, and leaves follow-up available', () => {
    const c = ctx();
    toReview(c, 'P1', content('fail'));
    promptWallet(c, { participantId: 'P1' });
    connectWallet(c, { participantId: 'P1' });
    attemptAcknowledgement(c, { participantId: 'P1', outcome: 'failure' });
    expect(c.store.byType('WalletAcknowledgementSucceeded')).toHaveLength(0);
    expect(status(c, 'P1')).toBe('qualified');
    expect(createFollowUp(c, { participantId: 'P1', followUpType: 'intro_call', actor: 'operations' }).reviewId).toBe('R-P1-1');
  });

  it('a succeeded ack is final (cannot be overwritten), while retry after a failure is allowed', () => {
    const c = ctx();
    toReview(c, 'P1', content('final'));
    promptWallet(c, { participantId: 'P1' });
    connectWallet(c, { participantId: 'P1' });
    attemptAcknowledgement(c, { participantId: 'P1', outcome: 'failure' });
    expect(attemptAcknowledgement(c, { participantId: 'P1', outcome: 'success' }).status).toBe('success');
    expectCode(() => attemptAcknowledgement(c, { participantId: 'P1', outcome: 'failure' }), 'invalid_state');
    expect(c.store.byType('WalletAcknowledgementFailed').length).toBe(1);
  });

  it('follow-up never gates the wallet: ack works with no follow-up', () => {
    const c = ctx();
    toReview(c, 'P1', content('nofollow'));
    promptWallet(c, { participantId: 'P1' });
    connectWallet(c, { participantId: 'P1' });
    expect(attemptAcknowledgement(c, { participantId: 'P1', outcome: 'success' }).status).toBe('success');
    expect(c.store.byType('BusinessFollowUpCreated')).toHaveLength(0);
  });

  it('wallet activity (via commands) never moves any funnel or conversion number', () => {
    const c = ctx();
    toReview(c, 'P1', content('a'));
    toReview(c, 'P2', content('b'));
    createFollowUp(c, { participantId: 'P1', followUpType: 'intro_call', actor: 'operations' });
    const strip = (m: ReturnType<typeof computeFunnelMetrics>) => ({
      ...m,
      acknowledgementAttempts: 0,
      acknowledgementSucceeded: 0,
      acknowledgementSuccess: null,
    });
    const before = strip(computeFunnelMetrics(c.store.all()));
    promptWallet(c, { participantId: 'P2' });
    connectWallet(c, { participantId: 'P2' });
    attemptAcknowledgement(c, { participantId: 'P2', outcome: 'success' });
    promptWallet(c, { participantId: 'P1' });
    declineWallet(c, { participantId: 'P1' });
    const after = computeFunnelMetrics(c.store.all());
    expect(strip(after)).toEqual(before);
    expect(after.businessFollowUpConversion.numerator).toBe(1); // P2's ack is not a conversion
    expect(after.acknowledgementSucceeded).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('INV-5 business follow-up guard', () => {
  it('refuses follow-up for duplicate, abuse, rejected, and every pre-qualification state', () => {
    const c = ctx();
    toReview(c, 'OK', content('owner'));
    toReview(c, 'DUP', content('owner'));
    toReview(c, 'BOT', content('bot'), { abuseProfile: 'synthetic_bot' });
    toReview(c, 'JUNK', { section: 'treasury', question: 'Looks good.', whyItMatters: 'Nice work.' });
    acquire(c, 'ACQ');
    acquire(c, 'WL');
    registerWaitlist(c, { participantId: 'WL' });
    acquire(c, 'VIEW');
    registerWaitlist(c, { participantId: 'VIEW' });
    viewDisclosure(c, { participantId: 'VIEW', sectionsSeen: ALL_SECTIONS });
    for (const id of ['DUP', 'BOT', 'JUNK', 'ACQ', 'WL', 'VIEW']) {
      expectCode(() => createFollowUp(c, { participantId: id, followUpType: 'intro_call', actor: 'operations' }), 'not_qualified');
    }
    expect(c.store.byType('BusinessFollowUpCreated')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('INV-6 conversion counts distinct qualified reviews', () => {
  it('several follow-ups on one qualified review convert once', () => {
    const c = ctx();
    toReview(c, 'P1', content('multi'));
    toReview(c, 'P2', content('none'));
    createFollowUp(c, { participantId: 'P1', followUpType: 'intro_call', actor: 'operations' });
    createFollowUp(c, { participantId: 'P1', followUpType: 'diligence_request', actor: 'partner' });
    const m = computeFunnelMetrics(c.store.all());
    expect(m.followUpsCreated).toBe(2);
    expect(m.businessFollowUpConversion).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
  });
});

// ---------------------------------------------------------------------------
describe('INV-7 command/analytics event coverage', () => {
  it('the seed (played through the real commands) emits every schema event type', () => {
    const emitted = new Set(buildSyntheticStore().all().map((e) => e.type));
    const schema = Object.keys(EVENT_FAMILY) as EventType[];
    expect(schema.filter((t) => !emitted.has(t))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('INV-8 determinism and causal ordering', () => {
  function assertCausal(events: readonly DomainEvent[]) {
    const ids = [...new Set(events.map((e) => e.participantId).filter(Boolean))] as string[];
    for (const id of ids) {
      const own = events.filter((e) => e.participantId === id);
      expect(own[0].type).toBe('AcquisitionVisited');
      // Lifecycle rank never goes backwards across the participant's events.
      let rank = -1;
      for (let i = 1; i <= own.length; i++) {
        const s = deriveStatus(own.slice(0, i));
        expect(s).toBeDefined();
        expect(STATUS_RANK[s!]).toBeGreaterThanOrEqual(rank);
        rank = STATUS_RANK[s!];
      }
      // Submit -> Evaluated -> one terminal disposition, contiguous.
      const sub = own.findIndex((e) => e.type === 'ReviewSubmitted');
      if (sub >= 0) {
        expect(own[sub + 1].type).toBe('ReviewEvaluated');
        expect(['ReviewQualified', 'ReviewRejected', 'ReviewFlaggedDuplicate', 'ReviewFlaggedAbuse']).toContain(own[sub + 2].type);
      }
      // Follow-up and wallet events only ever appear after ReviewQualified.
      const q = own.findIndex((e) => e.type === 'ReviewQualified');
      own.forEach((e, i) => {
        if (e.type === 'BusinessFollowUpCreated' || EVENT_FAMILY[e.type] === 'wallet') {
          expect(q).toBeGreaterThanOrEqual(0);
          expect(i).toBeGreaterThan(q);
        }
      });
    }
  }

  it('buildSyntheticStore twice yields identical logs whose per-participant order is causal', () => {
    const a = buildSyntheticStore().all();
    expect(buildSyntheticStore().all()).toEqual(a);
    assertCausal(a);
  });

  it('seed + all demo scenarios also yield a causal log', () => {
    resetLiveSession();
    const store = buildSyntheticStore();
    const c = createContext(store, DISCLOSURE, () => '2026-09-20T09:00:00.000Z');
    for (const s of DEMO_SCENARIOS) playJourney(c, s.build(1));
    assertCausal(store.all());
  });
});

// ---------------------------------------------------------------------------
describe('INV-9 demo scenarios hit their intended gate, not an accidental one', () => {
  function gatesOf(events: readonly DomainEvent[], idPrefix: string) {
    const ev = events.find(
      (e): e is Extract<DomainEvent, { type: 'ReviewEvaluated' }> =>
        e.type === 'ReviewEvaluated' && e.participantId.startsWith(idPrefix),
    );
    if (!ev) throw new Error(`no evaluation for ${idPrefix}`);
    return Object.fromEntries(ev.checks.map((g) => [g.gate, g.passed]));
  }

  it('fails only the intended gate(s) per scenario, and demo ids never collide with seed ids', () => {
    resetLiveSession();
    const store = buildSyntheticStore();
    const seedIds = new Set(store.all().map((e) => e.participantId));
    const c = createContext(store, DISCLOSURE, () => '2026-09-20T09:00:00.000Z');
    for (const s of [...DEMO_SCENARIOS].reverse()) {
      const rec = s.build(1);
      expect(seedIds.has(rec.id)).toBe(false);
      playJourney(c, rec);
    }
    const all = store.all();
    const failed = (p: string) => Object.entries(gatesOf(all, p)).filter(([, ok]) => !ok).map(([g]) => g);
    expect(failed('DEMO-A')).toEqual([]);
    expect(failed('DEMO-B')).toEqual([]); // B is not a duplicate of anything
    expect(failed('DEMO-C')).toEqual(['not_duplicate']); // intentional repost of U007
    expect(failed('DEMO-D')).toEqual([]); // D is clean, not abuse
    expect(failed('DEMO-E')).toEqual(expect.arrayContaining(['complete']));
    expect(failed('DEMO-E')).not.toContain('not_duplicate');
    expect(failed('DEMO-F')).toEqual(['not_abuse']); // F fails on abuse alone, fields complete
  });

  it('running every scenario twice (fresh run numbers) keeps each intended disposition', () => {
    resetLiveSession();
    const store = buildSyntheticStore();
    const c = createContext(store, DISCLOSURE, () => '2026-09-20T09:00:00.000Z');
    for (const run of [1, 2]) {
      for (const s of DEMO_SCENARIOS) playJourney(c, s.build(run));
    }
    const rows = buildParticipantRows(store.all());
    const row = (id: string) => rows.find((r) => r.id === id);
    for (const run of [1, 2]) {
      expect(row(`DEMO-A${run}`)?.reviewDisposition).toBe('qualified');
      expect(row(`DEMO-B${run}`)?.reviewDisposition).toBe('qualified');
      expect(row(`DEMO-C${run}`)?.reviewDisposition).toBe('duplicate');
      expect(row(`DEMO-C${run}`)?.duplicateOfReviewId).toBe('R-U007-1');
      expect(row(`DEMO-D${run}`)?.reviewDisposition).toBe('qualified');
      expect(row(`DEMO-E${run}`)?.reviewDisposition).toBe('rejected');
      expect(row(`DEMO-F${run}`)?.reviewDisposition).toBe('abuse_flagged');
    }
  });

  it('re-using a run number for an id already in the store is refused (no silent overwrite)', () => {
    const store = buildSyntheticStore();
    const c = createContext(store, DISCLOSURE, () => '2026-09-20T09:00:00.000Z');
    const a = DEMO_SCENARIOS.find((s) => s.id === 'A')!;
    playJourney(c, a.build(1));
    const size = store.size();
    expectCode(() => playJourney(c, a.build(1)), 'participant_exists');
    expect(store.size()).toBe(size);
  });
});
