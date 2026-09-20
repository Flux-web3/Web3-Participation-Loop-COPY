import type { Participant, ParticipantId } from '@/domain';
import type { CommandContext } from './context';
import { requireParticipant, reproject } from './context';
import { CommandError } from './errors';

/** Join the waitlist. Requires an acquired participant; open to any channel. */
export interface RegisterWaitlistInput {
  participantId: ParticipantId;
}

export function registerWaitlist(ctx: CommandContext, input: RegisterWaitlistInput): Participant {
  const { participant } = requireParticipant(ctx, input.participantId);
  if (participant.status !== 'acquired') {
    throw new CommandError('invalid_state', `registerWaitlist requires status 'acquired', got '${participant.status}'`);
  }
  ctx.store.append({
    type: 'WaitlistRegistered',
    occurredAt: ctx.clock(),
    participantId: participant.id,
    channel: participant.channel,
  });
  return reproject(ctx, participant.id);
}
