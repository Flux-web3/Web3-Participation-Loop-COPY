import { describe, it, expect } from 'vitest';
import { InMemoryEventStore, createInMemoryEventStore, createEventId } from '@/data';
import type { NewEvent } from '@/domain';

/**
 * The event store is the single source of truth, so its two invariants are load-
 * bearing for every downstream metric: (1) `sequence` is monotonic from 1 and
 * assigned by the store (never the caller), and (2) `id` is a deterministic
 * function of the sequence. These tests pin both.
 */

function acq(participantId: string): NewEvent {
  return {
    type: 'AcquisitionVisited',
    occurredAt: '2026-02-01T00:00:00.000Z',
    participantId,
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
  };
}

describe('createEventId', () => {
  it('zero-pads the sequence to six digits', () => {
    expect(createEventId(1)).toBe('evt_000001');
    expect(createEventId(42)).toBe('evt_000042');
    expect(createEventId(123456)).toBe('evt_123456');
  });
});

describe('InMemoryEventStore', () => {
  it('assigns monotonic sequences from 1 and deterministic ids', () => {
    const store = createInMemoryEventStore();
    expect(store.nextSequence()).toBe(1);

    const a = store.append(acq('U001'));
    expect(a.sequence).toBe(1);
    expect(a.id).toBe('evt_000001');

    const b = store.append(acq('U002'));
    expect(b.sequence).toBe(2);
    expect(b.id).toBe('evt_000002');

    expect(store.nextSequence()).toBe(3);
    expect(store.size()).toBe(2);
  });

  it('appendMany preserves argument order and continues the sequence', () => {
    const store = createInMemoryEventStore();
    const stored = store.appendMany([acq('U001'), acq('U002'), acq('U003')]);
    expect(stored.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(store.all().map((e) => e.participantId)).toEqual(['U001', 'U002', 'U003']);
  });

  it('all() returns events in insertion (sequence) order', () => {
    const store = createInMemoryEventStore();
    store.append(acq('U001'));
    store.append(acq('U002'));
    expect(store.all().map((e) => e.sequence)).toEqual([1, 2]);
  });

  it('byParticipant returns only that participant\'s events, in order', () => {
    const store = createInMemoryEventStore();
    store.append(acq('U001'));
    store.append(acq('U002'));
    store.append({ type: 'WaitlistRegistered', occurredAt: 't', participantId: 'U001', channel: 'direct' });

    const u1 = store.byParticipant('U001');
    expect(u1.map((e) => e.type)).toEqual(['AcquisitionVisited', 'WaitlistRegistered']);
    expect(store.byParticipant('U002')).toHaveLength(1);
  });

  it('byType narrows to the matching union member', () => {
    const store = createInMemoryEventStore();
    store.append(acq('U001'));
    store.append({ type: 'WaitlistRegistered', occurredAt: 't', participantId: 'U001', channel: 'direct' });

    const acqs = store.byType('AcquisitionVisited');
    expect(acqs).toHaveLength(1);
    // Field only present on AcquisitionVisited — compiles iff the type narrowed.
    expect(acqs[0]?.eligibility).toBe('eligible');
  });

  it('exposes the concrete class with an empty initial state', () => {
    const store = new InMemoryEventStore();
    expect(store.size()).toBe(0);
    expect(store.nextSequence()).toBe(1);
    expect(store.all()).toEqual([]);
  });
});
