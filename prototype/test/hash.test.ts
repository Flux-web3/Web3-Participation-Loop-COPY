import { describe, expect, it } from 'vitest';
import { contentHash, normalizeText, sha256Hex, wordCount } from '@/lib/hash';
import { createHash } from 'node:crypto';

describe('lib/hash', () => {
  it('matches the published SHA-256 vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches node:crypto sha256 output (browser/Node parity)', () => {
    const sample = 'Different kinds of question  text, with punctuation!\němphasis on determinism';
    expect(sha256Hex(sample)).toBe(createHash('sha256').update(sample).digest('hex'));
  });

  it('normalizes then hashes content deterministically', () => {
    const content = { section: 'treasury', question: ' Is THIS  the same?', whyItMatters: 'Yes, identical.' };
    const other = { section: 'governance', question: '   is this the same?', whyItMatters: 'yes, identical.' };
    expect(contentHash(content)).toBe(contentHash(other));
    expect(contentHash(content)).toHaveLength(64);
  });

  it('counts words across both substantive fields', () => {
    expect(wordCount({ section: 'x', question: 'One two', whyItMatters: 'three four five' })).toBe(5);
    expect(wordCount({ section: 'x', question: '   ', whyItMatters: '' })).toBe(0);
  });

  it('normalizeText is stable and strips punctuation', () => {
    expect(normalizeText('Hello, WORLD!! Multi   space')).toBe('hello world multi space');
  });
});