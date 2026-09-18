import { describe, it, expect } from 'vitest';
import { GATE_IDS, GATE_ORDER, FAILURE_PRECEDENCE } from '@/domain';
import type { GateId } from '@/domain';

describe('qualification gates', () => {
  it('defines exactly the seven gates in canonical order', () => {
    expect(GATE_ORDER).toEqual([
      'eligible',
      'disclosure_viewed',
      'complete',
      'section_referenced',
      'substantive',
      'not_duplicate',
      'not_abuse',
    ]);
    expect(GATE_ORDER).toEqual(GATE_IDS);
  });

  it('covers every gate exactly once in the failure precedence', () => {
    const gates = FAILURE_PRECEDENCE.map((r) => r.gate);
    expect(new Set(gates).size).toBe(gates.length);
    expect([...gates].sort()).toEqual([...GATE_IDS].sort());
  });

  it('orders precedence as abuse -> ineligible -> duplicate -> invalid', () => {
    const order = FAILURE_PRECEDENCE.map((r) => r.gate);
    const idx = (g: GateId) => order.indexOf(g);
    // abuse first, then ineligible, then duplicate, then the remaining validity gates.
    expect(idx('not_abuse')).toBe(0);
    expect(idx('not_abuse')).toBeLessThan(idx('eligible'));
    expect(idx('eligible')).toBeLessThan(idx('not_duplicate'));
    expect(idx('not_duplicate')).toBeLessThan(idx('disclosure_viewed'));
    expect(idx('not_duplicate')).toBeLessThan(idx('complete'));
    expect(idx('not_duplicate')).toBeLessThan(idx('section_referenced'));
    expect(idx('not_duplicate')).toBeLessThan(idx('substantive'));
  });

  it('maps failing gates to the correct dispositions', () => {
    const byGate = Object.fromEntries(FAILURE_PRECEDENCE.map((r) => [r.gate, r] as const));
    expect(byGate.not_abuse.disposition).toBe('abuse_flagged');
    expect(byGate.eligible.disposition).toBe('rejected');
    expect(byGate.eligible.reason).toBe('ineligible');
    expect(byGate.not_duplicate.disposition).toBe('duplicate');
    expect(byGate.complete.disposition).toBe('rejected');
    expect(byGate.substantive.reason).toBe('non_substantive');
  });
});
