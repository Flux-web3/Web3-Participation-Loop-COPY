import type { DomainEvent, EventType } from './schema';

/**
 * Disjoint families that partition the event space. `wallet` is deliberately
 * separate from every measurement-relevant family so the optional on-chain
 * acknowledgement can never influence qualification or conversion.
 */
export const EVENT_FAMILIES = ['funnel', 'quality', 'qualified', 'conversion', 'wallet'] as const;
export type EventFamily = (typeof EVENT_FAMILIES)[number];

export const EVENT_FAMILY: Record<EventType, EventFamily> = {
  AcquisitionVisited: 'funnel',
  WaitlistRegistered: 'funnel',
  DisclosureViewed: 'funnel',
  ReviewSubmitted: 'funnel',
  ReviewEvaluated: 'quality',
  ReviewRejected: 'quality',
  ReviewFlaggedDuplicate: 'quality',
  ReviewFlaggedAbuse: 'quality',
  ReviewQualified: 'qualified',
  BusinessFollowUpCreated: 'conversion',
  WalletPrompted: 'wallet',
  WalletConnectionDeclined: 'wallet',
  WalletConnected: 'wallet',
  WalletAcknowledgementAttempted: 'wallet',
  WalletAcknowledgementSucceeded: 'wallet',
  WalletAcknowledgementFailed: 'wallet',
};

/** Families that participate in qualification/conversion measurement (everything but wallet). */
export const QUALIFICATION_RELEVANT_FAMILIES = [
  'funnel',
  'quality',
  'qualified',
  'conversion',
] as const satisfies readonly EventFamily[];

export function familyOf(event: DomainEvent | EventType): EventFamily {
  const type = typeof event === 'string' ? event : event.type;
  return EVENT_FAMILY[type];
}

export function isWalletEvent(event: DomainEvent | EventType): boolean {
  return familyOf(event) === 'wallet';
}

/**
 * Whether an event can influence qualified participation or business conversion.
 * Wallet events must NEVER affect qualification — this keeps the optional
 * on-chain acknowledgement a pure side-channel.
 */
export function affectsQualification(event: DomainEvent | EventType): boolean {
  return familyOf(event) !== 'wallet';
}
