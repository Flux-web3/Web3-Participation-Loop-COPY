import type { DomainEvent, EventType, ReviewQualifiedEvent } from './schema';
import type { ParticipantId } from '../ids';
import { affectsQualification, isWalletEvent } from './families';

/** Exhaustiveness helper for discriminated-union switches. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

/**
 * Wallet-separation invariant at the event level: no single event may be both a
 * wallet event AND able to affect qualification. True for every event by
 * construction; asserted across the whole schema to prevent regressions.
 */
export function respectsWalletSeparation(event: DomainEvent | EventType): boolean {
  return !(isWalletEvent(event) && affectsQualification(event));
}

/**
 * Idempotency identity for qualified participation. Qualification is counted per
 * participant, so this key dedupes qualified reviews down to distinct participants.
 */
export function qualificationIdentity(event: ReviewQualifiedEvent): ParticipantId {
  return event.participantId;
}
