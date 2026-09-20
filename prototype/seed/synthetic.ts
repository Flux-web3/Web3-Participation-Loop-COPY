import type {
  AbuseProfile,
  Channel,
  EligibilityStatus,
  FollowUpActor,
  FollowUpType,
  ParticipantId,
  ReviewContent,
  SectionId,
} from '@/domain';
import type { EventStore } from '@/data';
import type { ParticipantRow } from '@/analytics';
import type { CommandContext } from '@/commands/context';
import { buildParticipantRows } from '@/analytics';
import { createContext } from '@/commands/context';
import {
  acceptAcquisition,
  attemptAcknowledgement,
  connectWallet,
  createFollowUp,
  declineWallet,
  promptWallet,
  registerWaitlist,
  submitReview,
  viewDisclosure,
} from '@/commands';
import { DISCLOSURE } from '@/data/disclosure';
import { createInMemoryEventStore } from '@/data/store';

/**
 * Deterministic synthetic dataset for the prototype.
 *
 * The database is the event log: every participant is played through the same
 * command handlers the browser uses (no hand-written events), so the seeded
 * log is exactly what a real run would produce. The store, the operations
 * table, and `data/synthetic-participants.csv` are all generated from the one
 * declarative spec below — they can never disagree, and the whole dataset is
 * reproducible from HEAD at any time.
 *
 * All records are synthetic and clearly labelled as such in the CSV export
 * (`synthetic=true`). Nothing here represents a real participant.
 */

/** Number of labelled synthetic participants. */
export const SYNTHETIC_PARTICIPANT_COUNT = 20;

/** Fixed base timestamp so the log is byte-identical on every run. */
export const SEED_BASE_TIMESTAMP = '2026-09-20T09:00:00.000Z';

/**
 * Every step after acquisition. The journey is the *intent* authored here; the
 * command layer enforces all state guards, so an invalid journey is impossible
 * by construction.
 */
export type SeedStep =
  | { step: 'waitlist' }
  | { step: 'view'; disclosureVersion?: number; sectionsSeen?: SectionId[] }
  | { step: 'submit'; disclosureVersion?: number; content: ReviewContent }
  | { step: 'followup'; followUpType: FollowUpType; actor?: FollowUpActor }
  | { step: 'wallet.decline' }
  | { step: 'wallet.connect' }
  | { step: 'wallet.ack'; outcome: 'success' | 'failure'; simulatedRef?: string; errorCode?: string };

export interface SyntheticSeedRecord {
  id: ParticipantId;
  /** Human scenario label (also written to the CSV). */
  label: string;
  channel: Channel;
  eligibility: EligibilityStatus;
  abuseProfile: AbuseProfile;
  journey: readonly SeedStep[];
}

/** Full disclosure sections — every submit must reference one of these. */
const SECTIONS = DISCLOSURE.sections.map((s) => s.id);

/**
 * The 20 labelled scenarios. They cover the takeover brief's required matrix:
 * normal qualified participant, wallet declined, duplicate submission, failed
 * acknowledgement, invalid review (each rejection reason), abuse/bot, all seven
 * acquisition channels, and varied disclosure/review states (acquired only,
 * waitlisted only, viewed only).
 */
export const SYNTHETIC_SEED: readonly SyntheticSeedRecord[] = [
  { id: 'U001', label: 'acquired_only', channel: 'social', eligibility: 'eligible', abuseProfile: 'clean', journey: [] },
  { id: 'U002', label: 'waitlisted_only', channel: 'community', eligibility: 'eligible', abuseProfile: 'clean', journey: [{ step: 'waitlist' }] },
  {
    id: 'U003',
    label: 'disclosure_viewed_only',
    channel: 'referral',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [{ step: 'waitlist' }, { step: 'view' }],
  },
  {
    id: 'U004',
    label: 'disclosure_viewed_only',
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [{ step: 'waitlist' }, { step: 'view', sectionsSeen: ['treasury', 'governance'] }],
  },
  { id: 'U005', label: 'acquired_only', channel: 'partner', eligibility: 'eligible', abuseProfile: 'clean', journey: [] },
  { id: 'U006', label: 'waitlisted_only', channel: 'other', eligibility: 'eligible', abuseProfile: 'clean', journey: [{ step: 'waitlist' }] },
  {
    id: 'U007',
    label: 'normal_qualified_acknowledged',
    channel: 'campaign',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'treasury',
          question: 'How would treasury assets be held and what key-rotation or custody policy is missing from the disclosure?',
          whyItMatters:
            'The disclosure names a multisig but never describes signer independence, key rotation, or recovery procedures, which makes the custody risk impossible to assess.',
        },
      },
      { step: 'followup', followUpType: 'intro_call' },
      { step: 'wallet.connect' },
      { step: 'wallet.ack', outcome: 'success', simulatedRef: 'SIM-ACK-007' },
    ],
  },
  {
    id: 'U008',
    label: 'qualified_wallet_declined',
    channel: 'campaign',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'governance',
          question: 'How are community proposals weighted and what happens when the core team disagrees with the community?',
          whyItMatters:
            'The governance section omits decision authority, conflict handling, and the difference between advisory input and binding votes, so stakeholders cannot know who actually controls outcomes.',
        },
      },
      { step: 'wallet.decline' },
    ],
  },
  {
    id: 'U009',
    label: 'qualified_no_wallet',
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'roadmap',
          question: 'What acceptance criteria and dates would confirm each roadmap milestone is actually complete?',
          whyItMatters:
            'Milestones are qualitative with no measurable definition of done, so progress reporting could claim completion without any verifiable evidence of delivery.',
        },
      },
    ],
  },
  {
    id: 'U010',
    label: 'qualified_acknowledgement_failed',
    channel: 'social',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'risk_factors',
          question: 'Which specific risk is most understated and what mitigation would reduce its likelihood?',
          whyItMatters:
            'Generic risk language without quantified exposure hides a dependency risk that a specific mitigation plan could substantially reduce.',
        },
      },
      { step: 'followup', followUpType: 'diligence_request', actor: 'operations' },
      { step: 'wallet.connect' },
      { step: 'wallet.ack', outcome: 'failure', errorCode: 'SIM_TX_FAILED' },
    ],
  },
  {
    id: 'U011',
    label: 'qualified_acknowledged',
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'overview',
          question: 'What exactly does the program promise and how does the participation model avoid implying ownership or reward?',
          whyItMatters:
            'The overview must distinguish a community review exercise from an investment so that participants never infer rights or returns that are absent.',
        },
      },
      { step: 'wallet.connect' },
      { step: 'wallet.ack', outcome: 'success', simulatedRef: 'SIM-ACK-011' },
    ],
  },
  {
    id: 'U012',
    label: 'qualified_wallet_declined',
    channel: 'community',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'participation',
          question: 'Why is the on-chain acknowledgement optional and what does it signify if it is completed?',
          whyItMatters:
            'Clarifying that the acknowledgement confers no entitlement prevents a participant from mistaking simulation for substance and misrepresenting it to others.',
        },
      },
      { step: 'wallet.decline' },
    ],
  },
  {
    id: 'U013',
    label: 'duplicate_submission',
    channel: 'direct',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'treasury',
          question: 'How would treasury assets be held and what key-rotation or custody policy is missing from the disclosure?',
          whyItMatters:
            'The disclosure names a multisig but never describes signer independence, key rotation, or recovery procedures, which makes the custody risk impossible to assess.',
        },
      },
    ],
  },
  {
    id: 'U014',
    label: 'abuse_bot',
    channel: 'social',
    eligibility: 'eligible',
    abuseProfile: 'synthetic_bot',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'treasury',
          question: 'How is the treasury custody arrangement structured across independent signers and cold storage?',
          whyItMatters:
            'The disclosure names a multisig but omits signer independence, which materially affects custody risk.',
        },
      },
    ],
  },
  {
    id: 'U015',
    label: 'rejected_ineligible',
    channel: 'other',
    eligibility: 'ineligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'participation',
          question: 'Who is entitled to participate and what are the eligibility conditions for joining the waitlist?',
          whyItMatters:
            'Eligibility is a latent attribute that gates review qualification, so stating the conditions openly protects the program from confusion.',
        },
      },
    ],
  },
  {
    id: 'U016',
    label: 'rejected_non_substantive',
    channel: 'campaign',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      { step: 'submit', content: { section: 'treasury', question: 'Looks good.', whyItMatters: 'Nice work.' } },
    ],
  },
  {
    id: 'U017',
    label: 'rejected_version_mismatch',
    channel: 'campaign',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view', disclosureVersion: 1 },
      {
        step: 'submit',
        disclosureVersion: 1,
        content: {
          section: 'governance',
          question: 'Which version of the governance section is authoritative and how are proposals actually ratified?',
          whyItMatters:
            'Version confusion in a disclosure undermines trust, so the current authoritative text must be unambiguous.',
        },
      },
    ],
  },
  {
    id: 'U018',
    label: 'rejected_incomplete',
    channel: 'social',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: { section: 'roadmap', question: 'What milestones are scheduled this quarter?', whyItMatters: '' },
      },
    ],
  },
  {
    id: 'U019',
    label: 'rejected_no_section_reference',
    channel: 'community',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'nope',
          question: 'Does this disclosure address compensation at all?',
          whyItMatters:
            'Nothing in the document mentions compensation, so the omission should at least be acknowledged as a material gap.',
        },
      },
    ],
  },
  {
    id: 'U020',
    label: 'normal_qualified_acknowledgement_failed',
    channel: 'partner',
    eligibility: 'eligible',
    abuseProfile: 'clean',
    journey: [
      { step: 'waitlist' },
      { step: 'view' },
      {
        step: 'submit',
        content: {
          section: 'treasury',
          question: 'How are treasury decisions governed and where does the disclosure document the signer responsibilities?',
          whyItMatters:
            'Without a documented responsible party the treasury section remains an assertion; attribution of accountability is what separates the disclosure from marketing text.',
        },
      },
      { step: 'followup', followUpType: 'partner_routing', actor: 'partner' },
      { step: 'wallet.connect' },
      { step: 'wallet.ack', outcome: 'failure', errorCode: 'SIM_TX_FAILED' },
    ],
  },
];

if (SYNTHETIC_SEED.length !== SYNTHETIC_PARTICIPANT_COUNT) {
  throw new Error('seed spec size changed without updating SYNTHETIC_PARTICIPANT_COUNT');
}

/** Deterministic clock: one minute per emitted event from the fixed base. */
export function seedClock(): () => string {
  let t = Date.parse(SEED_BASE_TIMESTAMP);
  return () => {
    t += 60_000;
    return new Date(t).toISOString();
  };
}

/**
 * Play one record's journey through the command layer. Shared by
 * {@link buildSyntheticStore} and the browser UI so that seeded and live
 * participants take identical, guard-enforced journeys.
 */
export function playJourney(ctx: CommandContext, record: SyntheticSeedRecord): void {
  acceptAcquisition(ctx, {
    participantId: record.id,
    channel: record.channel,
    eligibility: record.eligibility,
    abuseProfile: record.abuseProfile,
  });
  for (const step of record.journey) {
    switch (step.step) {
      case 'waitlist':
        registerWaitlist(ctx, { participantId: record.id });
        break;
      case 'view':
        viewDisclosure(ctx, {
          participantId: record.id,
          sectionsSeen: step.sectionsSeen ?? SECTIONS,
          disclosureVersion: step.disclosureVersion,
        });
        break;
      case 'submit':
        submitReview(ctx, {
          participantId: record.id,
          content: step.content,
          disclosureVersion: step.disclosureVersion,
        });
        break;
      case 'followup':
        createFollowUp(ctx, { participantId: record.id, followUpType: step.followUpType, actor: step.actor ?? 'operations' });
        break;
      case 'wallet.decline':
        promptWallet(ctx, { participantId: record.id });
        declineWallet(ctx, { participantId: record.id });
        break;
      case 'wallet.connect':
        promptWallet(ctx, { participantId: record.id });
        connectWallet(ctx, { participantId: record.id });
        break;
      case 'wallet.ack':
        attemptAcknowledgement(ctx, {
          participantId: record.id,
          outcome: step.outcome,
          ...(step.simulatedRef ? { simulatedRef: step.simulatedRef } : {}),
          ...(step.errorCode ? { errorCode: step.errorCode } : {}),
        });
        break;
    }
  }
}

/**
 * Play the whole dataset through the command layer into a fresh store.
 * Deterministic: same spec, same store, same sequence numbers, same ids.
 */
export function buildSyntheticStore(): EventStore {
  const store = createInMemoryEventStore();
  const ctx = createContext(store, DISCLOSURE, seedClock());

  for (const record of SYNTHETIC_SEED) {
    playJourney(ctx, record);
  }
  return store;
}

export interface SyntheticParticipantRow extends ParticipantRow {
  label: string;
}

/** Operations rows enriched with scenario labels, in stable id order. */
export function syntheticRows(): SyntheticParticipantRow[] {
  const rows = buildParticipantRows(buildSyntheticStore().all());
  const labels = new Map(SYNTHETIC_SEED.map((r) => [r.id, r.label]));
  return rows.map((row) => ({ ...row, label: labels.get(row.id) ?? '' }));
}

/** CSV record per participant. All rows are labelled synthetic. */
export function syntheticCsvText(): string {
  const header = [
    'participant_id',
    'scenario_label',
    'acquisition_channel',
    'eligibility',
    'abuse_profile',
    'lifecycle_status',
    'review_disposition',
    'rejection_reason',
    'duplicate_of_review',
    'review_id',
    'review_section',
    'wallet_ack_status',
    'follow_up_count',
    'synthetic',
  ].join(',');
  const lines = syntheticRows().map((r) =>
    [
      r.id,
      r.label,
      r.channel,
      r.eligibility,
      r.abuseProfile,
      r.status ?? '',
      r.reviewDisposition ?? '',
      r.rejectionReason ?? '',
      r.duplicateOfReviewId ?? '',
      r.reviewId ?? '',
      r.reviewSection ?? '',
      r.walletAckStatus,
      String(r.followUpCount),
      'true',
    ].join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}