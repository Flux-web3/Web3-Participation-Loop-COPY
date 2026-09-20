import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPES,
  EVENT_FAMILY,
  EVENT_FAMILIES,
  QUALIFICATION_RELEVANT_FAMILIES,
  affectsQualification,
  isWalletEvent,
  respectsWalletSeparation,
  familyOf,
} from '@/domain';
import { ALL_SAMPLE_EVENTS, SAMPLE_EVENTS } from './fixtures';

describe('event schema', () => {
  it('has unique event types', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });

  it('maps every event type to exactly one family', () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_FAMILIES).toContain(EVENT_FAMILY[type]);
    }
    expect(Object.keys(EVENT_FAMILY).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it('provides a sample for every event type (union fully covered)', () => {
    expect(Object.keys(SAMPLE_EVENTS).sort()).toEqual([...EVENT_TYPES].sort());
    for (const type of EVENT_TYPES) {
      expect(SAMPLE_EVENTS[type].type).toBe(type);
    }
  });

  it('carries disclosureVersion on both the view and the submission (audit trail)', () => {
    expect(SAMPLE_EVENTS.DisclosureViewed.disclosureVersion).toBeTypeOf('number');
    expect(SAMPLE_EVENTS.ReviewSubmitted.disclosureVersion).toBeTypeOf('number');
  });

  it('uses a simulated (non-real) wallet acknowledgement reference', () => {
    expect(SAMPLE_EVENTS.WalletAcknowledgementSucceeded.simulatedRef).toMatch(/^SIM-ACK-/);
  });
});

describe('wallet separation', () => {
  it('keeps the wallet family disjoint from qualification-relevant families', () => {
    for (const family of QUALIFICATION_RELEVANT_FAMILIES) {
      expect(family).not.toBe('wallet');
    }
    // The five families partition the space; wallet is the only excluded one.
    const relevant = new Set<string>(QUALIFICATION_RELEVANT_FAMILIES);
    expect(EVENT_FAMILIES.filter((f) => !relevant.has(f))).toEqual(['wallet']);
  });

  it('classifies wallet events as not affecting qualification, and vice versa', () => {
    for (const event of ALL_SAMPLE_EVENTS) {
      expect(affectsQualification(event)).toBe(!isWalletEvent(event));
    }
  });

  it('holds respectsWalletSeparation for every event (no event is both)', () => {
    for (const event of ALL_SAMPLE_EVENTS) {
      expect(respectsWalletSeparation(event)).toBe(true);
    }
  });

  it('classifies each wallet event type into the wallet family', () => {
    const walletTypes = [
      'WalletPrompted',
      'WalletConnectionDeclined',
      'WalletConnected',
      'WalletAcknowledgementAttempted',
      'WalletAcknowledgementSucceeded',
      'WalletAcknowledgementFailed',
    ] as const;
    for (const type of walletTypes) {
      expect(familyOf(type)).toBe('wallet');
    }
  });
});
