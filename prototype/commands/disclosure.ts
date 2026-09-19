import type { Participant, ParticipantId, SectionId } from '@/domain';
import type { CommandContext } from './context';
import { requireParticipant, reproject } from './context';
import { CommandError } from './errors';

/**
 * Open the disclosure. Records which sections were seen and against which
 * version — the submit step later checks that the reviewed version matches the
 * viewed version and the current version. Re-viewing is allowed.
 */
export interface ViewDisclosureInput {
  participantId: ParticipantId;
  sectionsSeen: SectionId[];
  /** Version viewed; defaults to the current disclosure version. */
  disclosureVersion?: number;
}

export function viewDisclosure(ctx: CommandContext, input: ViewDisclosureInput): Participant {
  const { participant } = requireParticipant(ctx, input.participantId);
  if (participant.status !== 'waitlisted' && participant.status !== 'disclosure_viewed') {
    throw new CommandError(
      'invalid_state',
      `viewDisclosure requires status 'waitlisted' or 'disclosure_viewed', got '${participant.status}'`,
    );
  }
  ctx.store.append({
    type: 'DisclosureViewed',
    occurredAt: ctx.clock(),
    participantId: participant.id,
    disclosureId: ctx.disclosure.id,
    disclosureVersion: input.disclosureVersion ?? ctx.disclosure.version,
    sectionsSeen: input.sectionsSeen,
  });
  return reproject(ctx, participant.id);
}
