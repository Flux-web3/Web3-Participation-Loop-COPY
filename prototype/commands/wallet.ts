import type { AcknowledgementId, EventType, ParticipantId, ReviewId } from '@/domain';
import type { CommandContext } from './context';
import { requireParticipant } from './context';
import { CommandError } from './errors';

/**
 * Optional, simulated on-chain acknowledgement — the SECOND independent branch
 * off a qualified review, entirely orthogonal to business follow-up. Every
 * event here belongs to the disjoint `wallet` event family, so nothing in this
 * file can influence qualification or conversion. There is no real wallet, SDK,
 * RPC, mainnet transaction, token, or reward; acknowledgement confers nothing.
 *
 * Flow: prompt → (decline) | (connect → attempt → success | failure).
 * All commands require a qualified participant, because the acknowledgement is
 * only ever offered after qualification — offering it never feeds back into it.
 */

function hasEvent(ctx: CommandContext, participantId: ParticipantId, type: EventType): boolean {
  return ctx.store.byParticipant(participantId).some((e) => e.type === type);
}

function promptedReviewId(ctx: CommandContext, participantId: ParticipantId): ReviewId | undefined {
  return ctx.store.byType('WalletPrompted').find((e) => e.participantId === participantId)?.reviewId;
}

function qualifiedReviewId(ctx: CommandContext, participantId: ParticipantId): ReviewId | undefined {
  return ctx.store.byType('ReviewQualified').find((e) => e.participantId === participantId)?.reviewId;
}

function requireQualified(ctx: CommandContext, participantId: ParticipantId): void {
  const { participant } = requireParticipant(ctx, participantId);
  if (participant.status !== 'qualified') {
    throw new CommandError(
      'not_qualified',
      `wallet acknowledgement is offered only to qualified participants; '${participant.id}' is '${participant.status}'`,
    );
  }
}

/** Offer the optional acknowledgement to a qualified participant (once). */
export function promptWallet(ctx: CommandContext, input: { participantId: ParticipantId; reviewId?: ReviewId }): void {
  requireQualified(ctx, input.participantId);
  if (hasEvent(ctx, input.participantId, 'WalletPrompted')) {
    throw new CommandError('already_prompted', `participant '${input.participantId}' was already prompted`);
  }
  const reviewId = input.reviewId ?? qualifiedReviewId(ctx, input.participantId);
  ctx.store.append({
    type: 'WalletPrompted',
    occurredAt: ctx.clock(),
    participantId: input.participantId,
    ...(reviewId ? { reviewId } : {}),
  });
}

/** Participant declines to connect a wallet. Optional and consequence-free. */
export function declineWallet(ctx: CommandContext, input: { participantId: ParticipantId }): void {
  requireQualified(ctx, input.participantId);
  if (!hasEvent(ctx, input.participantId, 'WalletPrompted')) {
    throw new CommandError('wallet_not_prompted', `participant '${input.participantId}' was not prompted`);
  }
  const reviewId = promptedReviewId(ctx, input.participantId);
  ctx.store.append({
    type: 'WalletConnectionDeclined',
    occurredAt: ctx.clock(),
    participantId: input.participantId,
    ...(reviewId ? { reviewId } : {}),
  });
}

/** Participant opts to connect a (simulated) wallet. Still fully optional. */
export function connectWallet(ctx: CommandContext, input: { participantId: ParticipantId }): void {
  requireQualified(ctx, input.participantId);
  if (!hasEvent(ctx, input.participantId, 'WalletPrompted')) {
    throw new CommandError('wallet_not_prompted', `participant '${input.participantId}' was not prompted`);
  }
  const reviewId = promptedReviewId(ctx, input.participantId);
  ctx.store.append({
    type: 'WalletConnected',
    occurredAt: ctx.clock(),
    participantId: input.participantId,
    ...(reviewId ? { reviewId } : {}),
  });
}

export interface AttemptAcknowledgementInput {
  participantId: ParticipantId;
  /** Deterministic simulated outcome. */
  outcome: 'success' | 'failure';
  /** Fake reference on success (defaults to SIM-ACK-001). */
  simulatedRef?: string;
  /** Simulated error code on failure (defaults to SIM_TX_FAILED). */
  errorCode?: string;
}

export interface AttemptAcknowledgementResult {
  acknowledgementId: AcknowledgementId;
  status: 'success' | 'failed';
}

/** Attempt the simulated acknowledgement. Requires a connected wallet. */
export function attemptAcknowledgement(
  ctx: CommandContext,
  input: AttemptAcknowledgementInput,
): AttemptAcknowledgementResult {
  requireQualified(ctx, input.participantId);
  if (!hasEvent(ctx, input.participantId, 'WalletConnected')) {
    throw new CommandError('wallet_not_connected', `participant '${input.participantId}' has no connected wallet`);
  }
  // A succeeded acknowledgement is final: a later attempt must not be able to
  // overwrite the recorded success. Retrying after a failure stays allowed.
  if (hasEvent(ctx, input.participantId, 'WalletAcknowledgementSucceeded')) {
    throw new CommandError('invalid_state', `participant '${input.participantId}' already has a successful acknowledgement`);
  }
  const n = ctx.store.byType('WalletAcknowledgementAttempted').filter((e) => e.participantId === input.participantId).length + 1;
  const acknowledgementId: AcknowledgementId = `ACK-${input.participantId}-${n}`;
  const reviewId = promptedReviewId(ctx, input.participantId);
  const occurredAt = ctx.clock();

  ctx.store.append({
    type: 'WalletAcknowledgementAttempted',
    occurredAt,
    participantId: input.participantId,
    acknowledgementId,
    ...(reviewId ? { reviewId } : {}),
  });

  if (input.outcome === 'success') {
    ctx.store.append({
      type: 'WalletAcknowledgementSucceeded',
      occurredAt,
      participantId: input.participantId,
      acknowledgementId,
      simulatedRef: input.simulatedRef ?? 'SIM-ACK-001',
    });
    return { acknowledgementId, status: 'success' };
  }

  ctx.store.append({
    type: 'WalletAcknowledgementFailed',
    occurredAt,
    participantId: input.participantId,
    acknowledgementId,
    errorCode: input.errorCode ?? 'SIM_TX_FAILED',
  });
  return { acknowledgementId, status: 'failed' };
}
