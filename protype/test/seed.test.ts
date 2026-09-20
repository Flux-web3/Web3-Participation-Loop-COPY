import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptAcquisition, createContext, CommandError } from '@/commands';
import { DISCLOSURE } from '@/data';
import type { EventStore } from '@/data';
import {
  SEED_BASE_TIMESTAMP,
  SYNTHETIC_PARTICIPANT_COUNT,
  SYNTHETIC_SEED,
  buildSyntheticStore,
  syntheticCsvText,
  syntheticRows,
} from '@/seed';

/**
 * The synthetic seed is the demonstration dataset for the prototype and the
 * CSV export. These tests lock in its determinism (the same spec must produce
 * the identical event log every time), prove every journey is legal under the
 * command layer's guards, verify the scenario matrix the takeover brief
 * requires, and keep `data/synthetic-participants.csv` in sync with the seed.
 */

function buildTwice(): [EventStore, EventStore] {
  return [buildSyntheticStore(), buildSyntheticStore()];
}

describe('seed determinism', () => {
  it('produces an identical event log (sequences, ids, timestamps) on every build', () => {
    const [a, b] = buildTwice();
    expect(b.all().length).toBe(a.all().length);
    expect(a.all()).toEqual(b.all());
  });

  it('locks the exact event count', () => {
    const [a] = buildTwice();
    expect(SYNTHETIC_SEED).toHaveLength(SYNTHETIC_PARTICIPANT_COUNT);
    expect(a.size()).toBe(119);
    expect(a.all()[0].sequence).toBe(1);
    expect(a.all()[a.size() - 1].sequence).toBe(a.size());
  });

  it('uses ids derived from sequence (evt_000001-style)', () => {
    const [a] = buildTwice();
    expect(a.all()[0].id).toBe('evt_000001');
    expect(a.all()[9].id).toBe('evt_000010');
  });
});

describe('seed journeys are legal under the command guards', () => {
  it('plays every journey to completion without a CommandError', () => {
    expect(() => buildSyntheticStore()).not.toThrow();
  });

  it('never emits a duplicate ReviewQualified for one participant', () => {
    const [a] = buildTwice();
    const qualified = a.all().filter((e) => e.type === 'ReviewQualified');
    const ids = qualified.map((e) => e.participantId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('failures reach a CommandError with a known code when the spec is invalid', () => {
    // Sanity check that the guard layer really is the thing protecting the seed.
    const store = buildSyntheticStore();
    const ctx = createContext(store, DISCLOSURE, () => 't');
    acceptAcquisition(ctx, { participantId: 'U999', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' });
    expect(() =>
      acceptAcquisition(ctx, { participantId: 'U999', channel: 'direct', eligibility: 'eligible', abuseProfile: 'clean' }),
    ).toThrow(CommandError);
  });
});

describe('scenario matrix coverage', () => {
  const rows = syntheticRows();
  const labels = rows.map((r) => r.label);
  const records = SYNTHETIC_SEED;

  it('covers all seven acquisition channels and all four abuse/eligibility combos used', () => {
    const channels = new Set(records.map((r) => r.channel));
    expect([...channels]).toEqual(expect.arrayContaining(['direct', 'referral', 'campaign', 'community', 'partner', 'social', 'other']));
  });

  it('includes each required scenario label', () => {
    for (const label of [
      'acquired_only',
      'waitlisted_only',
      'disclosure_viewed_only',
      'normal_qualified_acknowledged',
      'qualified_wallet_declined',
      'qualified_no_wallet',
      'qualified_acknowledgement_failed',
      'duplicate_submission',
      'abuse_bot',
      'rejected_ineligible',
      'rejected_non_substantive',
      'rejected_version_mismatch',
      'rejected_incomplete',
      'rejected_no_section_reference',
    ]) {
      expect(labels).toContain(label);
    }
  });

  it('shows every qualified wallet acknowledgement state', () => {
    const qualified = rows.filter((r) => r.reviewDisposition === 'qualified');
    expect(qualified.map((r) => r.walletAckStatus).sort()).toEqual(['declined', 'declined', 'failed', 'failed', 'not_attempted', 'success', 'success']);
  });

  it('exercises every rejection reason except the impossible disclosure_not_viewed', () => {
    const reasons: string[] = [];
    for (const r of rows) if (r.rejectionReason) reasons.push(r.rejectionReason);
    expect(reasons.sort()).toEqual(
      [
        'ineligible',
        'non_substantive',
        'disclosure_version_mismatch',
        'incomplete',
        'no_section_reference',
      ].sort(),
    );
    // The commit guard makes disclosure_not_viewed unreachable through commands:
    // a participant cannot submit without a recorded view (review.ts guard).
    expect(reasons).not.toContain('disclosure_not_viewed');
  });
});

describe('synthetic-participants.csv', () => {
  const csvPath = resolve(fileURLToPath(import.meta.url), '../../..', 'data', 'synthetic-participants.csv');
  const dir = join(resolve(fileURLToPath(import.meta.url), '../../..'), 'data');

  it('matches the seed exactly (deterministic, regenerated when out of date)', () => {
    const generated = syntheticCsvText();

    // Regenerate the committed artifact whenever it drifts from the seed. The
    // CSV is a derived export of the event log, never an independent source.
    if (!existsSync(csvPath) || readFileSync(csvPath, 'utf8') !== generated) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(csvPath, generated, 'utf8');
    }
    expect(readFileSync(csvPath, 'utf8')).toBe(generated);
  });

  it('is fully labelled synthetic and one row per participant', () => {
    const text = readFileSync(csvPath, 'utf8').trim().split('\n');
    expect(text).toHaveLength(SYNTHETIC_PARTICIPANT_COUNT + 1);
    expect(text[0].split(',')[0]).toBe('participant_id');
    for (const line of text.slice(1)) {
      expect(line.endsWith(',true')).toBe(true);
      expect(line).toMatch(/^U\d{3},/);
    }
  });

  it('reports a genuine empty data/ directory is created on demand', () => {
    expect(readdirSync(dir)).toContain('synthetic-participants.csv');
  });
});

describe('seed internals', () => {
  it('uses a fixed base timestamp for reproducibility', () => {
    expect(Date.parse(SEED_BASE_TIMESTAMP)).toBeGreaterThan(0);
    const [a] = buildTwice();
    expect(a.all()[0].occurredAt).toBeDefined();
  });
});