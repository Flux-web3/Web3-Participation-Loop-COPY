import type { AbuseProfile, EligibilityStatus, GateId, RejectionReason, ReviewDisposition } from '../enums';
import type { ReviewId, SectionId } from '../ids';
import type { GateCheck, QualificationResult, ReviewContent } from '../entities';
import { FAILURE_PRECEDENCE, GATE_ORDER } from './gates';

/** Tunable thresholds for the substantive-content gate. */
export interface SubstantiveThresholds {
  /** Minimum total words across question + why-it-matters. */
  minWordCount: number;
  /** Minimum words in the question field. */
  minQuestionWords: number;
  /** Minimum distinct words across the substantive fields. */
  minUniqueWords: number;
  /** Minimum distinct "content" words (length >= 4, excluding stopwords). */
  minContentWords: number;
}

export const DEFAULT_SUBSTANTIVE_THRESHOLDS: SubstantiveThresholds = {
  minWordCount: 12,
  minQuestionWords: 4,
  minUniqueWords: 8,
  minContentWords: 5,
};

// Small deterministic stopword list — enough to distinguish filler from a real
// disclosure-specific observation without pulling an NLP dependency.
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'what', 'when', 'where',
  'which', 'about', 'there', 'their', 'would', 'could', 'should', 'these', 'those',
  'because', 'really', 'very', 'just', 'like', 'good', 'nice', 'great', 'want',
]);

// Exact normalized phrases that are never substantive on their own.
const BOILERPLATE = new Set([
  'looks good', 'lgtm', 'nice', 'nice work', 'great', 'great project', 'good project',
  'interesting', 'i agree', 'agreed', 'no comment', 'gm', 'wen moon', 'to the moon',
  'cool', 'awesome', 'good luck', 'ok', 'okay', 'yes', 'no', 'thanks', 'thank you',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Inputs required to evaluate one review against the seven gates. */
export interface EvaluationInput {
  participant: {
    eligibility: EligibilityStatus;
    abuseProfile: AbuseProfile;
  };
  review: {
    content: ReviewContent;
    contentHash: string;
    /** Version the participant reviewed against. */
    disclosureVersion: number;
    wordCount: number;
  };
  disclosure: {
    version: number;
    sectionIds: readonly SectionId[];
  };
  /** Participant's latest disclosure view before this submission, if any. */
  priorView?: { disclosureVersion: number; sectionsSeen: readonly SectionId[] };
  /**
   * First-valid-writer-wins result: the id of the earliest previously-QUALIFIED
   * review sharing this content hash (undefined if no qualified review owns this
   * content — rejected/abuse/duplicate holders never own it). Computed by the
   * caller so the engine stays pure.
   */
  duplicateOf?: ReviewId;
  thresholds?: SubstantiveThresholds;
}

function evalDisclosureViewed(input: EvaluationInput): { passed: boolean; note: string; reason?: RejectionReason } {
  const submitted = input.review.disclosureVersion;
  const current = input.disclosure.version;
  const view = input.priorView;
  if (!view) {
    return { passed: false, note: 'no disclosure view recorded before submission', reason: 'disclosure_not_viewed' };
  }
  if (view.disclosureVersion !== submitted) {
    return {
      passed: false,
      note: `viewed v${view.disclosureVersion} but submitted against v${submitted}`,
      reason: 'disclosure_version_mismatch',
    };
  }
  if (submitted !== current) {
    return {
      passed: false,
      note: `submitted against outdated v${submitted} (current v${current})`,
      reason: 'disclosure_version_mismatch',
    };
  }
  return { passed: true, note: `viewed and submitted against current v${current}` };
}

function evalSubstantive(input: EvaluationInput): { passed: boolean; note: string } {
  const t = input.thresholds ?? DEFAULT_SUBSTANTIVE_THRESHOLDS;
  const { content, wordCount } = input.review;
  const questionTokens = tokenize(content.question);
  const combinedTokens = tokenize(`${content.question} ${content.whyItMatters}`);
  const normalizedCombined = combinedTokens.join(' ');
  const unique = new Set(combinedTokens);
  const contentWords = new Set(combinedTokens.filter((w) => w.length >= 4 && !STOPWORDS.has(w)));

  if (normalizedCombined.length === 0 || BOILERPLATE.has(normalizedCombined)) {
    return { passed: false, note: 'boilerplate / empty content' };
  }
  if (wordCount < t.minWordCount) {
    return { passed: false, note: `word count ${wordCount} < ${t.minWordCount}` };
  }
  if (questionTokens.length < t.minQuestionWords) {
    return { passed: false, note: `question has ${questionTokens.length} words < ${t.minQuestionWords}` };
  }
  if (unique.size < t.minUniqueWords) {
    return { passed: false, note: `${unique.size} unique words < ${t.minUniqueWords}` };
  }
  if (contentWords.size < t.minContentWords) {
    return { passed: false, note: `${contentWords.size} content words < ${t.minContentWords}` };
  }
  return { passed: true, note: `substantive (${contentWords.size} content words)` };
}

/**
 * Evaluate a review against the seven qualification gates and resolve a single
 * primary disposition via FAILURE_PRECEDENCE. Pure and deterministic: the full
 * gate breakdown is always returned regardless of which gate "wins".
 */
export function evaluateReview(input: EvaluationInput): QualificationResult {
  const eligible = input.participant.eligibility === 'eligible';
  const dv = evalDisclosureViewed(input);
  const c = input.review.content;
  const complete = c.section.trim().length > 0 && c.question.trim().length > 0 && c.whyItMatters.trim().length > 0;
  const sectionReferenced = input.disclosure.sectionIds.includes(c.section);
  const substantive = evalSubstantive(input);
  const notDuplicate = input.duplicateOf === undefined;
  const notAbuse = input.participant.abuseProfile !== 'synthetic_bot';

  const results: Record<GateId, GateCheck> = {
    eligible: { gate: 'eligible', passed: eligible, note: `eligibility: ${input.participant.eligibility}` },
    disclosure_viewed: { gate: 'disclosure_viewed', passed: dv.passed, note: dv.note },
    complete: {
      gate: 'complete',
      passed: complete,
      note: complete ? 'all structured fields present' : 'missing one or more structured fields',
    },
    section_referenced: {
      gate: 'section_referenced',
      passed: sectionReferenced,
      note: sectionReferenced ? `references section "${c.section}"` : `section "${c.section}" is not a disclosure section`,
    },
    substantive: { gate: 'substantive', passed: substantive.passed, note: substantive.note },
    not_duplicate: {
      gate: 'not_duplicate',
      passed: notDuplicate,
      note: notDuplicate ? 'unique content' : `duplicate of review ${input.duplicateOf}`,
    },
    not_abuse: {
      gate: 'not_abuse',
      passed: notAbuse,
      note: notAbuse ? 'no abuse signals' : 'synthetic bot profile',
    },
  };

  const checks = GATE_ORDER.map((gate) => results[gate]);

  let disposition: ReviewDisposition = 'qualified';
  let primaryReason: RejectionReason | undefined;
  let duplicateOfReviewId: ReviewId | undefined;

  for (const rule of FAILURE_PRECEDENCE) {
    if (!results[rule.gate].passed) {
      disposition = rule.disposition;
      if (rule.gate === 'disclosure_viewed') {
        primaryReason = dv.reason;
      } else if (rule.disposition === 'rejected') {
        primaryReason = rule.reason;
      }
      if (rule.gate === 'not_duplicate') {
        duplicateOfReviewId = input.duplicateOf;
      }
      break;
    }
  }

  return {
    disposition,
    checks,
    primaryReason,
    duplicateOfReviewId,
    qualifiesForConversion: disposition === 'qualified',
  };
}
