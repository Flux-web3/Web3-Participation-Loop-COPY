import type { GateId, RejectionReason, ReviewDisposition } from '../enums';
import { GATE_IDS } from '../enums';

/** Canonical order the seven gates are evaluated and displayed in. */
export const GATE_ORDER = GATE_IDS;

/** Maps a failed gate to the disposition (and reason) it produces. */
export interface FailureRule {
  gate: GateId;
  disposition: ReviewDisposition;
  reason?: RejectionReason;
}

/**
 * Precedence for selecting a single primary disposition when several gates fail.
 * The order encodes: abuse → ineligible → duplicate → invalid (the remaining
 * validity gates). The engine still records the full gate breakdown regardless
 * of which rule "wins" here.
 *
 * Note: the `disclosure_viewed` reason below is the default; the engine upgrades
 * it to `disclosure_version_mismatch` when a view exists but its version differs.
 */
export const FAILURE_PRECEDENCE: readonly FailureRule[] = [
  { gate: 'not_abuse', disposition: 'abuse_flagged' },
  { gate: 'eligible', disposition: 'rejected', reason: 'ineligible' },
  { gate: 'not_duplicate', disposition: 'duplicate' },
  { gate: 'disclosure_viewed', disposition: 'rejected', reason: 'disclosure_not_viewed' },
  { gate: 'complete', disposition: 'rejected', reason: 'incomplete' },
  { gate: 'section_referenced', disposition: 'rejected', reason: 'no_section_reference' },
  { gate: 'substantive', disposition: 'rejected', reason: 'non_substantive' },
];
