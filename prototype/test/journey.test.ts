import { describe, it, expect } from 'vitest';
import { dispositionOf } from '@/src/journey';

describe('live journey disposition mapping', () => {
  it('maps disposition event types to canonical dispositions', () => {
    expect(dispositionOf('ReviewQualified')).toBe('qualified');
    expect(dispositionOf('ReviewRejected')).toBe('rejected');
    expect(dispositionOf('ReviewFlaggedDuplicate')).toBe('duplicate');
    expect(dispositionOf('ReviewFlaggedAbuse')).toBe('abuse_flagged');
  });

  it('returns undefined for non-disposition and unknown events', () => {
    expect(dispositionOf('ReviewSubmitted')).toBeUndefined();
    expect(dispositionOf('WalletAcknowledgementSucceeded')).toBeUndefined();
    expect(dispositionOf(undefined)).toBeUndefined();
  });
});