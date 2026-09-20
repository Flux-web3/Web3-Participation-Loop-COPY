import { createHash } from 'node:crypto';
import type { ReviewContent } from '../domain/entities';

/** Lowercase, strip punctuation, collapse whitespace. Deterministic. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical string for duplicate detection. Uses the substantive fields
 * (question + why-it-matters) only, so re-tagging a different section cannot
 * evade first-writer-wins duplicate detection.
 */
export function normalizeContent(content: ReviewContent): string {
  return `${normalizeText(content.question)}\n${normalizeText(content.whyItMatters)}`;
}

/** Stable SHA-256 hex hash of the normalized content. */
export function contentHash(content: ReviewContent): string {
  return createHash('sha256').update(normalizeContent(content)).digest('hex');
}

/** Word count across the substantive fields. */
export function wordCount(content: ReviewContent): number {
  const combined = `${content.question} ${content.whyItMatters}`.trim();
  if (combined.length === 0) return 0;
  return combined.split(/\s+/).filter(Boolean).length;
}
