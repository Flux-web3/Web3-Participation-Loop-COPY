import type { FollowUpActor, FollowUpId, FollowUpType, ParticipantId, ReviewId } from '@/domain';
import type { CommandContext } from './context';
import { requireParticipant } from './context';
import { CommandError } from './errors';

/**
 * Create a business follow-up on a qualified review. This is the business-
 * conversion lane and is GUARDED: it requires the participant to have a
 * ReviewQualified event (status `qualified`). Follow-up is one of the two
 * independent branches off a qualified review; it has nothing to do with the
 * optional wallet acknowledgement. Multiple follow-ups per participant are
 * allowed (e.g. intro call + diligence request); the conversion metric counts
 * distinct qualified reviews with at least one follow-up.
 */
export interface CreateFollowUpInput {
  participantId: ParticipantId;
  followUpType: FollowUpType;
  actor: FollowUpActor;
}

export interface CreateFollowUpResult {
  followUpId: FollowUpId;
  reviewId: ReviewId;
}

export function createFollowUp(ctx: CommandContext, input: CreateFollowUpInput): CreateFollowUpResult {
  const { participant } = requireParticipant(ctx, input.participantId);
  if (participant.status !== 'qualified') {
    throw new CommandError(
      'not_qualified',
      `business follow-up requires a qualified review; participant '${participant.id}' is '${participant.status}'`,
    );
  }
  const qualified = ctx.store.byType('ReviewQualified').find((e) => e.participantId === participant.id);
  if (!qualified) {
    throw new CommandError('not_qualified', `no qualified review for participant '${participant.id}'`);
  }
  const n = ctx.store.byType('BusinessFollowUpCreated').filter((f) => f.participantId === participant.id).length + 1;
  const followUpId: FollowUpId = `F-${participant.id}-${n}`;
  ctx.store.append({
    type: 'BusinessFollowUpCreated',
    occurredAt: ctx.clock(),
    participantId: participant.id,
    followUpId,
    reviewId: qualified.reviewId,
    followUpType: input.followUpType,
    actor: input.actor,
  });
  return { followUpId, reviewId: qualified.reviewId };
}
