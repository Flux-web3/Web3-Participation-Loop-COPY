import { describe, it, expect } from 'vitest';
import { evaluateReview } from '@/domain';
import type {
  AbuseProfile,
  EligibilityStatus,
  EvaluationInput,
  ReviewContent,
  ReviewId,
  SectionId,
} from '@/domain';
import { contentHash, wordCount } from '@/lib/hash';

const SECTION_IDS: readonly SectionId[] = [
  'project_overview',
  'use_of_funds',
  'treasury',
  'risk_factors',
  'reporting_methodology',
  'governance',
];

const GOOD_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'How is the treasury custody arrangement structured across independent signers and cold storage?',
  whyItMatters:
    'The disclosure names a multisig but omits signer independence and geographic distribution, which materially affects custody risk.',
};

interface Overrides {
  eligibility?: EligibilityStatus;
  abuseProfile?: AbuseProfile;
  content?: ReviewContent;
  disclosureVersion?: number; // submitted-against version
  currentVersion?: number;
  priorView?: { disclosureVersion: number; sectionsSeen: readonly SectionId[] };
  noView?: boolean;
  duplicateOf?: ReviewId;
}

function makeInput(o: Overrides = {}): EvaluationInput {
  const content = o.content ?? GOOD_CONTENT;
  const submitted = o.disclosureVersion ?? 2;
  const current = o.currentVersion ?? 2;
  const input: EvaluationInput = {
    participant: {
      eligibility: o.eligibility ?? 'eligible',
      abuseProfile: o.abuseProfile ?? 'clean',
    },
    review: {
      content,
      contentHash: contentHash(content),
      disclosureVersion: submitted,
      wordCount: wordCount(content),
    },
    disclosure: { version: current, sectionIds: SECTION_IDS },
  };
  if (!o.noView) {
    input.priorView = o.priorView ?? { disclosureVersion: submitted, sectionsSeen: SECTION_IDS };
  }
  if (o.duplicateOf !== undefined) input.duplicateOf = o.duplicateOf;
  return input;
}

describe('evaluateReview — happy path', () => {
  it('qualifies a complete, substantive, section-referenced review', () => {
    const r = evaluateReview(makeInput());
    expect(r.disposition).toBe('qualified');
    expect(r.qualifiesForConversion).toBe(true);
    expect(r.primaryReason).toBeUndefined();
    expect(r.duplicateOfReviewId).toBeUndefined();
    expect(r.checks).toHaveLength(7);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('always returns the full 7-gate breakdown in canonical order', () => {
    const r = evaluateReview(makeInput({ eligibility: 'ineligible' }));
    expect(r.checks.map((c) => c.gate)).toEqual([
      'eligible',
      'disclosure_viewed',
      'complete',
      'section_referenced',
      'substantive',
      'not_duplicate',
      'not_abuse',
    ]);
  });
});

describe('evaluateReview — individual gate failures', () => {
  it('rejects an ineligible participant', () => {
    const r = evaluateReview(makeInput({ eligibility: 'ineligible' }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('ineligible');
    expect(r.qualifiesForConversion).toBe(false);
  });

  it('rejects when the disclosure was never viewed', () => {
    const r = evaluateReview(makeInput({ noView: true }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('disclosure_not_viewed');
  });

  it('rejects when the viewed version differs from the submitted version', () => {
    const r = evaluateReview(
      makeInput({ priorView: { disclosureVersion: 1, sectionsSeen: SECTION_IDS }, disclosureVersion: 2 }),
    );
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('disclosure_version_mismatch');
  });

  it('rejects when submitting against an outdated disclosure version', () => {
    const r = evaluateReview(
      makeInput({ priorView: { disclosureVersion: 1, sectionsSeen: SECTION_IDS }, disclosureVersion: 1, currentVersion: 2 }),
    );
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('disclosure_version_mismatch');
  });

  it('rejects an incomplete review (missing a structured field)', () => {
    const r = evaluateReview(makeInput({ content: { ...GOOD_CONTENT, whyItMatters: '' } }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('incomplete');
  });

  it('rejects a review that references no real disclosure section', () => {
    const r = evaluateReview(makeInput({ content: { ...GOOD_CONTENT, section: 'not_a_section' } }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('no_section_reference');
  });

  it('rejects a non-substantive review ("Looks good.")', () => {
    const r = evaluateReview(makeInput({ content: { section: 'treasury', question: 'Looks good', whyItMatters: 'Nice' } }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('non_substantive');
  });

  it('flags a duplicate (first-writer-wins) and records the original', () => {
    const r = evaluateReview(makeInput({ duplicateOf: 'R-first' }));
    expect(r.disposition).toBe('duplicate');
    expect(r.duplicateOfReviewId).toBe('R-first');
    expect(r.qualifiesForConversion).toBe(false);
  });

  it('flags an abusive (synthetic bot) submission', () => {
    const r = evaluateReview(makeInput({ abuseProfile: 'synthetic_bot' }));
    expect(r.disposition).toBe('abuse_flagged');
    expect(r.qualifiesForConversion).toBe(false);
  });
});

describe('evaluateReview — precedence (abuse -> ineligible -> duplicate -> invalid)', () => {
  it('abuse outranks every other failure', () => {
    const r = evaluateReview(
      makeInput({
        abuseProfile: 'synthetic_bot',
        eligibility: 'ineligible',
        duplicateOf: 'R-x',
        noView: true,
        content: { section: 'treasury', question: 'Looks good', whyItMatters: 'Nice' },
      }),
    );
    expect(r.disposition).toBe('abuse_flagged');
  });

  it('ineligible outranks duplicate', () => {
    const r = evaluateReview(makeInput({ eligibility: 'ineligible', duplicateOf: 'R-x' }));
    expect(r.disposition).toBe('rejected');
    expect(r.primaryReason).toBe('ineligible');
  });

  it('duplicate outranks ordinary validity failures', () => {
    const r = evaluateReview(
      makeInput({ duplicateOf: 'R-x', content: { section: 'treasury', question: 'Looks good', whyItMatters: 'Nice' } }),
    );
    expect(r.disposition).toBe('duplicate');
  });
});
