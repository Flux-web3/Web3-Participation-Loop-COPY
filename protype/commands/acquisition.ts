import type { AbuseProfile, Channel, EligibilityStatus, Participant, ParticipantId } from '@/domain';
import type { CommandContext } from './context';
import { loadParticipant, reproject } from './context';
import { CommandError } from './errors';

/**
 * Open acquisition entry. A visitor arrives through a channel and becomes a
 * tracked participant. Entry is open — no invitation token. The synthetic
 * `eligibility` and `abuseProfile` attributes are minted here but do NOT gate
 * entry; they are read only later, at qualification. `channel` is attribution.
 */
export interface AcceptAcquisitionInput {
  participantId: ParticipantId;
  channel: Channel;
  eligibility: EligibilityStatus;
  abuseProfile: AbuseProfile;
}

export function acceptAcquisition(ctx: CommandContext, input: AcceptAcquisitionInput): Participant {
  if (loadParticipant(ctx, input.participantId).participant) {
    throw new CommandError('participant_exists', `participant '${input.participantId}' already acquired`);
  }
  ctx.store.append({
    type: 'AcquisitionVisited',
    occurredAt: ctx.clock(),
    participantId: input.participantId,
    channel: input.channel,
    eligibility: input.eligibility,
    abuseProfile: input.abuseProfile,
  });
  return reproject(ctx, input.participantId);
}
