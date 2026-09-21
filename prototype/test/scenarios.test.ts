import { describe, it, expect } from 'vitest';
import { createContext } from '@/commands/context';
import { DISCLOSURE } from '@/data/disclosure';
import { buildParticipantRows } from '@/analytics';
import { buildSyntheticStore, playJourney } from '@/seed';
import { DEMO_SCENARIOS } from '@/src/journey';

/**
 * The six scripted demo scenarios share one store (the deterministic
 * synthetic seed, exactly like the deployed journey view) when run back to
 * back. Their review content must be mutually distinct so the content-hash
 * duplicate gate never makes companion demos collide — except scenario C,
 * which intentionally reposts seed participant U007's review.
 */
describe('demo scenario grid in one store', () => {
  it('plays every scenario to its intended disposition without collisions', () => {
    const store = buildSyntheticStore();
    const ctx = createContext(store, DISCLOSURE, () => '2026-09-20T09:00:00.000Z');

    for (const scenario of DEMO_SCENARIOS) {
      playJourney(ctx, scenario.build(1));
    }

    const rows = buildParticipantRows(store.all());
    const byPrefix = (id: string) => rows.find((r) => r.id.startsWith(`DEMO-${id}`));

    expect(byPrefix('A')?.reviewDisposition).toBe('qualified');
    expect(byPrefix('B')?.reviewDisposition).toBe('qualified');
    expect(byPrefix('C')?.reviewDisposition).toBe('duplicate');
    expect(byPrefix('C')?.duplicateOfReviewId).toBe('R-U007-1');
    expect(byPrefix('D')?.reviewDisposition).toBe('qualified');
    expect(byPrefix('E')?.reviewDisposition).toBe('rejected');
    expect(byPrefix('F')?.reviewDisposition).toBe('abuse_flagged');
  });
});