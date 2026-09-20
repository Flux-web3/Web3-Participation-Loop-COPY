import type {
  Disclosure,
  DisclosureView,
  DomainEvent,
  Participant,
  ParticipantId,
  WalletAckStatus,
} from '@/domain';
import { deriveWalletStatus, latestDisclosureView, projectParticipant } from '@/domain';
import type { EventStore } from '@/data/store';
import { CommandError } from './errors';

/**
 * Everything a command handler needs: the append-only store to write to, the
 * current disclosure (for version + section ids), and a clock. Injecting the
 * clock keeps commands deterministic under test and seeding.
 */
export interface CommandContext {
  store: EventStore;
  disclosure: Disclosure;
  clock: () => string;
}

/** Real wall-clock ISO timestamp (used by API routes). */
export function nowClock(): string {
  return new Date().toISOString();
}

export function createContext(
  store: EventStore,
  disclosure: Disclosure,
  clock: () => string = nowClock,
): CommandContext {
  return { store, disclosure, clock };
}

/** A participant's derived state, loaded once at the top of a command. */
export interface LoadedParticipant {
  events: readonly DomainEvent[];
  participant: Participant | undefined;
  latestView: DisclosureView | undefined;
  walletStatus: WalletAckStatus;
}

export function loadParticipant(ctx: CommandContext, participantId: ParticipantId): LoadedParticipant {
  const events = ctx.store.byParticipant(participantId);
  return {
    events,
    participant: projectParticipant(events),
    latestView: latestDisclosureView(events),
    walletStatus: deriveWalletStatus(events),
  };
}

/** Load a participant that must already exist, or throw. */
export function requireParticipant(
  ctx: CommandContext,
  participantId: ParticipantId,
): { loaded: LoadedParticipant; participant: Participant } {
  const loaded = loadParticipant(ctx, participantId);
  if (!loaded.participant) {
    throw new CommandError('participant_not_found', `no participant '${participantId}'`);
  }
  return { loaded, participant: loaded.participant };
}

/** Re-project a participant after appending, asserting the projection exists. */
export function reproject(ctx: CommandContext, participantId: ParticipantId): Participant {
  const participant = projectParticipant(ctx.store.byParticipant(participantId));
  if (!participant) {
    throw new CommandError('invalid_state', `participant '${participantId}' has no projection`);
  }
  return participant;
}
