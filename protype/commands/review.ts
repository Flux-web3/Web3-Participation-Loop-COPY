import type {
  DomainEvent,
  ParticipantId,
  QualificationResult,
  ReviewContent,
  ReviewId,
} from '@/domain';
import { assertNever, evaluateReview } from '@/domain';
import { contentHash, wordCount } from '@/lib/hash';
import type { CommandContext } from './context';
import { requireParticipant } from './context';
import { CommandError } from './errors';

/**
 * Submit a review. This is the heart of the participation loop: it derives the
 * duplicate target (first-writer-wins over the append-only log), computes the
 * content hash + word count, runs the pure {@link evaluateReview} engine, and
 * appends exactly three events — ReviewSubmitted, the full ReviewEvaluated audit
 * record, and one terminal disposition event.
 *
 * Because the guard requires status `disclosure_viewed`, a participant submits
 * exactly one review, so at most one ReviewQualified event is ever emitted for
 * them (the idempotency the qualified-participation metric relies on).
 */
export interface SubmitReviewInput {
  participantId: ParticipantId;
  content: ReviewContent;
  /** Version reviewed against; defaults to the current disclosure version. */
  disclosureVersion?: number;
}

export interface SubmitReviewResult {
  reviewId: ReviewId;
  result: QualificationResult;
  events: DomainEvent[];
}

export function submitReview(ctx: CommandContext, input: SubmitReviewInput): SubmitReviewResult {
  const { store, disclosure, clock } = ctx;
  const { loaded, participant } = requireParticipant(ctx, input.participantId);
  if (participant.status !== 'disclosure_viewed') {
    throw new CommandError(
      'invalid_state',
      `submitReview requires status 'disclosure_viewed', got '${participant.status}'`,
    );
  }

  const hash = contentHash(input.content);
  const words = wordCount(input.content);
  const submittedVersion = input.disclosureVersion ?? disclosure.version;

  // First-writer-wins duplicate detection: the earliest previously-submitted
  // review that shares this normalized-content hash owns the content.
  const priorSubmitted = store.byType('ReviewSubmitted');
  const reviewNumber = priorSubmitted.filter((r) => r.participantId === participant.id).length + 1;
  const reviewId: ReviewId = `R-${participant.id}-${reviewNumber}`;
  const duplicateOf = priorSubmitted.find((r) => r.contentHash === hash)?.reviewId;

  const view = loaded.latestView;
  const result = evaluateReview({
    participant: { eligibility: participant.eligibility, abuseProfile: participant.abuseProfile },
    review: { content: input.content, contentHash: hash, disclosureVersion: submittedVersion, wordCount: words },
    disclosure: { version: disclosure.version, sectionIds: disclosure.sections.map((s) => s.id) },
    priorView: view ? { disclosureVersion: view.disclosureVersion, sectionsSeen: view.sectionsSeen } : undefined,
    duplicateOf,
  });

  const occurredAt = clock();
  const emitted: DomainEvent[] = [];

  emitted.push(
    store.append({
      type: 'ReviewSubmitted',
      occurredAt,
      participantId: participant.id,
      reviewId,
      disclosureId: disclosure.id,
      disclosureVersion: submittedVersion,
      content: input.content,
      contentHash: hash,
      wordCount: words,
    }),
  );

  emitted.push(
    store.append({
      type: 'ReviewEvaluated',
      occurredAt,
      participantId: participant.id,
      reviewId,
      disposition: result.disposition,
      checks: result.checks,
      primaryReason: result.primaryReason,
      duplicateOfReviewId: result.duplicateOfReviewId,
    }),
  );

  switch (result.disposition) {
    case 'qualified':
      emitted.push(store.append({ type: 'ReviewQualified', occurredAt, participantId: participant.id, reviewId }));
      break;
    case 'rejected':
      emitted.push(
        store.append({
          type: 'ReviewRejected',
          occurredAt,
          participantId: participant.id,
          reviewId,
          reason: result.primaryReason ?? 'non_substantive',
        }),
      );
      break;
    case 'duplicate': {
      const dupOf = result.duplicateOfReviewId ?? duplicateOf;
      if (!dupOf) {
        throw new CommandError('invalid_state', 'duplicate disposition without a duplicate target');
      }
      emitted.push(
        store.append({
          type: 'ReviewFlaggedDuplicate',
          occurredAt,
          participantId: participant.id,
          reviewId,
          duplicateOfReviewId: dupOf,
        }),
      );
      break;
    }
    case 'abuse_flagged':
      emitted.push(
        store.append({
          type: 'ReviewFlaggedAbuse',
          occurredAt,
          participantId: participant.id,
          reviewId,
          signals: ['synthetic_bot_profile'],
        }),
      );
      break;
    default:
      assertNever(result.disposition, 'unhandled review disposition');
  }

  return { reviewId, result, events: emitted };
}
