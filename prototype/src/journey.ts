import type {
  AbuseProfile,
  Channel,
  DomainEvent,
  EligibilityStatus,
  FollowUpType,
  GateCheck,
  ParticipantId,
  ReviewContent,
  SectionId,
  WalletAckStatus,
} from '@/domain';
import { CHANNELS, FOLLOW_UP_TYPES, STATUS_RANK, deriveWalletStatus, projectParticipant } from '@/domain';
import type { CommandContext } from '@/commands/context';
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
import { CommandError } from '@/commands/errors';
import { CURRENT_DISCLOSURE_VERSION, DISCLOSURE, DISCLOSURE_SECTION_IDS } from '@/data/disclosure';
import type { EventType } from '@/domain/events/schema';
import { playJourney, SYNTHETIC_SEED } from '@/seed';
import type { SeedStep, SyntheticSeedRecord } from '@/seed';
import { escapeHtml } from './format';

let live: { id: ParticipantId; channel: Channel; eligibility: EligibilityStatus; abuseProfile: AbuseProfile } | undefined;
let scenarioCounters: Record<string, number> = {};
/** Latest participant produced by each scripted scenario, for its result line. */
let scenarioRuns: Record<string, ParticipantId> = {};

export function resetLiveSession(): void {
  live = undefined;
  scenarioCounters = {};
  scenarioRuns = {};
}

/**
 * Repeat runs of a scenario get a run marker in the question so the
 * content-hash duplicate gate never turns a second run of A, B, D, E or F into
 * an accidental duplicate. Scenario C does not use this: it duplicates by design.
 */
function forRun(content: ReviewContent, run: number): ReviewContent {
  return run === 1 ? content : { ...content, question: `${content.question} (demo run ${run})` };
}

function nextRun(id: string): number {
  return (scenarioCounters[id] = (scenarioCounters[id] ?? 0) + 1);
}

interface Scenario {
  id: string;
  title: string;
  blurb: string;
  /** The outcome this scenario is designed to produce, shown next to the actual result. */
  expected: string;
  /** Builds the next run's record; `run` defaults to this scenario's next run number. */
  build: (run?: number) => SyntheticSeedRecord;
}

const HAPPY_PATH_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'What key-rotation and recovery policy would make the treasury custody model complete?',
  whyItMatters:
    'The disclosure describes a multisig but never states who holds keys, how they rotate, or what happens when a signer is unavailable, so custody risk is currently unassessable.',
};

// The remaining scripted scenarios use unique substantive reviews so the
// content-hash duplicate gate never makes two demo runs collide inside one
// shared store (scenario C is the exception by design: it reposts U007).
const WALLET_DECLINED_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'What signer quorum must approve a treasury operation, and where is that documented?',
  whyItMatters:
    'The disclosure names signers but never states the quorum or approval flow, so operational control of the treasury is ambiguous.',
};

const ACK_FAIL_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'Which wallet addresses are authorized to acknowledge, and who manages those signer keys?',
  whyItMatters:
    'Without an explicit set of expected acknowledgement addresses, a simulated acknowledgement cannot be verified by any observer.',
};

const ABUSE_BOT_CONTENT: ReviewContent = {
  section: 'treasury',
  question: 'How would a genuine participant independently verify a claim made in the disclosure?',
  whyItMatters:
    'The prototype integrity layer is declarative; a real deployment needs an external verifier to make the same signals auditable.',
};

function seedReviewContent(participantId: string): ReviewContent {
  const record = SYNTHETIC_SEED.find((r) => r.id === participantId);
  const step = record?.journey.find((s): s is Extract<SeedStep, { step: 'submit' }> => s.step === 'submit');
  if (!step) throw new CommandError('invalid_state', `seed participant '${participantId}' has no review to copy`);
  return step.content;
}

export const DEMO_SCENARIOS: readonly Scenario[] = [
  {
    id: 'A',
    title: 'Normal qualified participant',
    blurb: 'Full journey: the review qualifies, a business follow-up is recorded, and the optional acknowledgement succeeds.',
    expected: 'qualified · follow-up recorded · wallet success',
    build: (run = nextRun('A')) => ({
      id: `DEMO-A${run}`,
      label: 'demo_normal_qualified',
      channel: 'direct',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: forRun(HAPPY_PATH_CONTENT, run) },
        { step: 'followup', followUpType: 'intro_call' },
        { step: 'wallet.connect' },
        { step: 'wallet.ack', outcome: 'success' },
      ],
    }),
  },
  {
    id: 'B',
    title: 'Wallet declined participant',
    blurb: 'Qualifies, then declines the optional wallet. Qualification and follow-up eligibility are unaffected.',
    expected: 'qualified · follow-up available · wallet declined',
    build: (run = nextRun('B')) => ({
      id: `DEMO-B${run}`,
      label: 'demo_wallet_declined',
      channel: 'community',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: forRun(WALLET_DECLINED_CONTENT, run) },
        { step: 'wallet.decline' },
      ],
    }),
  },
  {
    id: 'C',
    title: 'Duplicate submission',
    blurb: "Reposts seed participant U007's qualified review verbatim. The content hash matches R-U007-1, so it is recorded as a duplicate and excluded.",
    expected: 'duplicate of R-U007-1 · no follow-up',
    build: (run = nextRun('C')) => ({
      id: `DEMO-C${run}`,
      label: 'demo_duplicate',
      channel: 'social',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [{ step: 'waitlist' }, { step: 'view' }, { step: 'submit', content: seedReviewContent('U007') }],
    }),
  },
  {
    id: 'D',
    title: 'Failed acknowledgement',
    blurb: 'Qualifies and connects a wallet, but the simulated acknowledgement fails. Qualification is unchanged.',
    expected: 'qualified · follow-up available · wallet failed',
    build: (run = nextRun('D')) => ({
      id: `DEMO-D${run}`,
      label: 'demo_ack_failed',
      channel: 'partner',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: forRun(ACK_FAIL_CONTENT, run) },
        { step: 'wallet.connect' },
        { step: 'wallet.ack', outcome: 'failure' },
      ],
    }),
  },
  {
    id: 'E',
    title: 'Invalid review',
    blurb: 'Submits "Looks good" with no reason given. It fails the completeness and substantive gates and is rejected.',
    expected: 'rejected (incomplete) · no follow-up',
    build: (run = nextRun('E')) => ({
      id: `DEMO-E${run}`,
      label: 'demo_invalid_review',
      channel: 'campaign',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [{ step: 'waitlist' }, { step: 'view' }, { step: 'submit', content: forRun({ section: 'overview', question: 'Looks good', whyItMatters: '' }, run) }],
    }),
  },
  {
    id: 'F',
    title: 'Abuse / bot profile',
    blurb: 'A bot-profile participant submits a well-formed review. It is abuse-flagged: excluded from conversion, visible to operations.',
    expected: 'abuse-flagged · no follow-up',
    build: (run = nextRun('F')) => ({
      id: `DEMO-F${run}`,
      label: 'demo_abuse_bot',
      channel: 'other',
      eligibility: 'eligible',
      abuseProfile: 'synthetic_bot',
      journey: [{ step: 'waitlist' }, { step: 'view' }, { step: 'submit', content: forRun(ABUSE_BOT_CONTENT, run) }],
    }),
  },
];

interface LiveState {
  participant: ReturnType<typeof projectParticipant>;
  walletStatus: WalletAckStatus;
  viewed: boolean;
  /** Version recorded by the most recent DisclosureViewed event. */
  viewedVersion?: number;
  submitted: boolean;
  disposition?: 'qualified' | 'rejected' | 'duplicate' | 'abuse_flagged';
  rejectionReason?: string;
  duplicateOf?: string;
  followUps: number;
  followUpType?: string;
  prompted: boolean;
  connected: boolean;
  ackAttempted: boolean;
  /** The seven-gate audit from the ReviewEvaluated event, once a review exists. */
  checks?: GateCheck[];
}

export function dispositionOf(type: EventType | undefined): LiveState['disposition'] {
  switch (type) {
    case 'ReviewQualified':
      return 'qualified';
    case 'ReviewRejected':
      return 'rejected';
    case 'ReviewFlaggedDuplicate':
      return 'duplicate';
    case 'ReviewFlaggedAbuse':
      return 'abuse_flagged';
    default:
      return undefined;
  }
}

function liveState(ctx: CommandContext, id: ParticipantId): LiveState {
  const events = ctx.store.byParticipant(id);
  const disposition = dispositionOf(events.find((e) => dispositionOf(e.type) !== undefined)?.type);
  return {
    participant: projectParticipant(events),
    walletStatus: deriveWalletStatus(events),
    viewed: events.some((e) => e.type === 'DisclosureViewed'),
    viewedVersion: events
      .filter((e): e is Extract<DomainEvent, { type: 'DisclosureViewed' }> => e.type === 'DisclosureViewed')
      .at(-1)?.disclosureVersion,
    submitted: events.some((e) => e.type === 'ReviewSubmitted'),
    disposition,
    rejectionReason: events.find((e) => e.type === 'ReviewRejected')?.reason,
    duplicateOf: events.find(
      (e): e is Extract<DomainEvent, { type: 'ReviewFlaggedDuplicate' }> => e.type === 'ReviewFlaggedDuplicate',
    )?.duplicateOfReviewId,
    followUps: events.filter((e) => e.type === 'BusinessFollowUpCreated').length,
    followUpType: events.find(
      (e): e is Extract<DomainEvent, { type: 'BusinessFollowUpCreated' }> => e.type === 'BusinessFollowUpCreated',
    )?.followUpType,
    prompted: events.some((e) => e.type === 'WalletPrompted'),
    connected: events.some((e) => e.type === 'WalletConnected'),
    ackAttempted: events.some((e) => e.type === 'WalletAcknowledgementAttempted'),
    checks: events.find(
      (e): e is Extract<DomainEvent, { type: 'ReviewEvaluated' }> => e.type === 'ReviewEvaluated',
    )?.checks,
  };
}

const OUTCOME_LABELS: Record<NonNullable<LiveState['disposition']>, string> = {
  qualified: 'Qualified',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
  abuse_flagged: 'Abuse-flagged',
};

const REASON_LABELS: Record<string, string> = {
  ineligible: 'the participant is not eligible',
  disclosure_not_viewed: 'the disclosure was not viewed before submitting',
  disclosure_version_mismatch: 'the review was not written against the current disclosure version',
  incomplete: 'one or more of the three required fields is empty',
  no_section_reference: 'it does not reference a section of the disclosure',
  non_substantive: 'it is too generic to be substantive',
};

const GATE_LABELS: Record<string, string> = {
  eligible: 'Eligible',
  disclosure_viewed: 'Disclosure viewed (current version)',
  complete: 'Complete (all three fields)',
  section_referenced: 'Disclosure section referenced',
  substantive: 'Substantive',
  not_duplicate: 'Not a duplicate',
  not_abuse: 'Not abuse-flagged',
};

/** One-line, event-derived summary of a participant's outcome. */
function outcomeSummary(state: LiveState): { text: string; ok: boolean } {
  if (!state.disposition) return { text: 'no review evaluated', ok: false };
  const parts: string[] = [];
  if (state.disposition === 'duplicate') parts.push(`duplicate of ${state.duplicateOf ?? 'an earlier review'}`);
  else if (state.disposition === 'rejected') parts.push(`rejected (${state.rejectionReason ?? 'gate failure'})`);
  else if (state.disposition === 'abuse_flagged') parts.push('abuse-flagged');
  else parts.push('qualified');
  const qualified = state.disposition === 'qualified';
  parts.push(state.followUps > 0 ? 'follow-up recorded' : qualified ? 'follow-up available' : 'no follow-up');
  if (qualified || state.walletStatus !== 'not_attempted') parts.push(`wallet ${state.walletStatus.replace('_', ' ')}`);
  return { text: parts.join(' · '), ok: qualified };
}

const SECTION_OPTIONS = DISCLOSURE.sections.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)} (${escapeHtml(s.id)})</option>`).join('');
const CHANNEL_OPTIONS = CHANNELS.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

export function renderJourney(root: HTMLElement, ctx: CommandContext, refresh: () => void): void {
  const totalEvents = ctx.store.size();
  const log = ctx.store
    .all()
    .slice(-60)
    .reverse()
    .map((e) => {
      const meta = e.participantId ? ` · ${e.participantId}` : '';
      const extra = e.type === 'ReviewRejected' ? ` · ${e.reason}` : e.type === 'ReviewFlaggedDuplicate' ? ` → dup of ${e.duplicateOfReviewId}` : '';
      return `<li>${escapeHtml(e.id)} ${escapeHtml(e.type)}${escapeHtml(meta)}${escapeHtml(extra)}</li>`;
    })
    .join('');

  const livePanel = live ? renderLive(ctx, live, refresh) : renderNewParticipant(ctx, refresh);

  const scenarios = DEMO_SCENARIOS.map(
    (s) => `
    <div class="card scenario">
      <div class="scenario-head">
        <span class="badge">${escapeHtml(s.id)}</span>
        <strong>${escapeHtml(s.title)}</strong>
      </div>
      <p class="muted">${escapeHtml(s.blurb)}</p>
      <p class="scenario-expected"><span>Expected</span> ${escapeHtml(s.expected)}</p>
      ${scenarioResult(ctx, s.id)}
      <button class="btn" data-action="scenario" data-id="${escapeHtml(s.id)}">${scenarioRuns[s.id] ? 'Run again' : `Run scenario ${escapeHtml(s.id)}`}</button>
    </div>`,
  ).join('');

  const disclosureHtml = DISCLOSURE.sections.map((s) => `
    <details class="section-doc">
      <summary>${escapeHtml(s.title)} <span class="muted">(${escapeHtml(s.id)})</span></summary>
      <p>${escapeHtml(s.body)}</p>
    </details>`).join('');

  root.innerHTML = `
    <h2>Participant Journey</h2>
    <p class="muted">
      Acquisition → Waitlist → Disclosure → Review → Qualification. A qualified review then opens two
      independent branches: business follow-up, and an optional simulated wallet acknowledgement.
      Every action appends to the same synthetic event log the Operations Dashboard reads.
    </p>

    <div class="two-col journey-cols">
      <section aria-label="Live interactive journey">
        <div class="card">
          <h3>Live journey</h3>
          ${livePanel}
        </div>
      </section>

      <section aria-label="Scripted demo scenarios">
        <h3>Scripted scenarios A–F</h3>
        <div class="scenario-grid">${scenarios}</div>
      </section>
    </div>

    <section aria-label="Disclosure document" class="card">
      <h3>The disclosure (v${CURRENT_DISCLOSURE_VERSION})</h3>
      <p class="muted">${escapeHtml(DISCLOSURE.disclaimer)}</p>
      ${disclosureHtml}
    </section>

    <section aria-label="Live event log" class="card">
      <h3>Recent events <span class="muted">(${totalEvents} total)</span></h3>
      <ul class="event-log mono">${log}</ul>
    </section>
  `;

  root.querySelectorAll<HTMLButtonElement>('button[data-action="scenario"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scenario = DEMO_SCENARIOS.find((s) => s.id === btn.dataset.id);
      if (!scenario) return;
      try {
        const record = scenario.build();
        scenarioRuns[scenario.id] = record.id;
        playJourney(ctx, record);
        refresh();
      } catch (err) {
        toast(err);
        refresh();
      }
    });
  });

  wireLiveActions(root, ctx, refresh);
}

function scenarioResult(ctx: CommandContext, scenarioId: string): string {
  const id = scenarioRuns[scenarioId];
  if (!id) return '';
  const summary = outcomeSummary(liveState(ctx, id));
  return `<p class="scenario-actual ${summary.ok ? 'ok' : 'bad'}" role="status"><span>Actual</span> <span class="mono">${escapeHtml(id)}</span> ${escapeHtml(summary.text)}</p>`;
}

function renderNewParticipant(ctx: CommandContext, refresh: () => void): string {
  void ctx; void refresh;
  return `
    <p class="muted">Create a synthetic participant and walk them through the loop step by step. The channel is recorded for attribution only; it never affects eligibility.</p>
    <div class="form-row">
      <label for="live-channel">Channel</label>
      <select id="live-channel">${CHANNEL_OPTIONS}</select>
    </div>
    <div class="form-row">
      <label for="live-eligibility">Eligibility profile</label>
      <select id="live-eligibility">
        <option value="eligible">eligible</option>
        <option value="ineligible">ineligible (rejected at the eligibility gate)</option>
      </select>
    </div>
    <div class="form-row">
      <label for="live-abuse">Abuse profile</label>
      <select id="live-abuse">
        <option value="clean">clean</option>
        <option value="synthetic_bot">synthetic bot (abuse-flagged at review)</option>
      </select>
    </div>
    <button class="btn primary" id="live-start">Acquire participant</button>
  `;
}

function wireLiveActions(root: HTMLElement, ctx: CommandContext, refresh: () => void): void {
  const start = root.querySelector<HTMLButtonElement>('#live-start');
  if (start) {
    start.addEventListener('click', () => {
      const channel = (root.querySelector<HTMLSelectElement>('#live-channel')?.value ?? 'direct') as Channel;
      const eligibility = (root.querySelector<HTMLSelectElement>('#live-eligibility')?.value ?? 'eligible') as EligibilityStatus;
      const abuseProfile = (root.querySelector<HTMLSelectElement>('#live-abuse')?.value ?? 'clean') as AbuseProfile;
      const id = `LIVE-${String(liveCount(ctx) + 1).padStart(3, '0')}`;
      try {
        acceptAcquisition(ctx, { participantId: id, channel, eligibility, abuseProfile });
        live = { id, channel, eligibility, abuseProfile };
        refresh();
      } catch (err) {
        toast(err);
        refresh();
      }
    });
  }

  const actions: ReadonlyArray<{ el: string; run: () => void }> = [
    {
      el: '#live-waitlist',
      run: () => live && registerWaitlist(ctx, { participantId: live.id }),
    },
    {
      el: '#live-view',
      run: () => {
        if (!live) return;
        const stale = root.querySelector<HTMLInputElement>('#live-stale')?.checked ?? false;
        viewDisclosure(ctx, {
          participantId: live.id,
          sectionsSeen: [...DISCLOSURE_SECTION_IDS] as SectionId[],
          disclosureVersion: stale ? 1 : undefined,
        });
      },
    },
    {
      el: '#live-reread',
      run: () =>
        live &&
        viewDisclosure(ctx, { participantId: live.id, sectionsSeen: [...DISCLOSURE_SECTION_IDS] as SectionId[] }),
    },
    {
      el: '#live-submit',
      run: () => {
        if (!live) return;
        const section = (root.querySelector<HTMLSelectElement>('#review-section')?.value ?? 'overview') as SectionId;
        const question = root.querySelector<HTMLInputElement>('#review-question')?.value ?? '';
        const whyItMatters = root.querySelector<HTMLInputElement>('#review-why')?.value ?? '';
        // The review is written against the version the participant actually read.
        // (The stale toggle only exists on the view step, so it cannot be re-read here.)
        submitReview(ctx, {
          participantId: live.id,
          content: { section, question, whyItMatters },
          disclosureVersion: liveState(ctx, live.id).viewedVersion,
        });
      },
    },
    {
      el: '#live-dup',
      run: () => {
        if (!live) return;
        const content = seedReviewContent('U007');
        submitReview(ctx, { participantId: live.id, content });
      },
    },
    {
      el: '#live-followup',
      run: () => {
        if (!live) return;
        const t = (root.querySelector<HTMLSelectElement>('#followup-type')?.value ?? FOLLOW_UP_TYPES[0]) as FollowUpType;
        createFollowUp(ctx, { participantId: live.id, followUpType: t, actor: 'operations' });
      },
    },
    {
      el: '#live-prompt',
      run: () => live && promptWallet(ctx, { participantId: live.id }),
    },
    {
      el: '#live-connect',
      run: () => live && connectWallet(ctx, { participantId: live.id }),
    },
    {
      el: '#live-decline',
      run: () => live && declineWallet(ctx, { participantId: live.id }),
    },
    {
      el: '#live-ack',
      run: () => {
        if (!live) return;
        const outcome = (root.querySelector<HTMLSelectElement>('#ack-outcome')?.value ?? 'success') as 'success' | 'failure';
        attemptAcknowledgement(ctx, { participantId: live.id, outcome });
      },
    },
    {
      el: '#live-reset-session',
      run: () => {
        // Only the live participant is cleared: scenario run counters must keep
        // counting, because the event log (and every DEMO-* id in it) is kept.
        live = undefined;
        refresh();
      },
    },
  ];

  for (const { el, run } of actions) {
    const btn = root.querySelector<HTMLButtonElement>(el);
    if (btn) {
      btn.addEventListener('click', () => {
        try {
          run();
          refresh();
        } catch (err) {
          toast(err);
          refresh();
        }
      });
    }
  }
}

function renderLive(ctx: CommandContext, session: NonNullable<typeof live>, refresh: () => void): string {
  const state = liveState(ctx, session.id);
  const status = state.participant?.status;

  // Five canonical journey chips; the final chip is the review outcome. Both
  // terminal statuses (qualified / disqualified) share STATUS_RANK 4 and resolve
  // to the outcome chip, so a disqualified participant lights the full stepper
  // with the outcome chip labelled by its disposition — never an all-grey stepper
  // that contradicts a red disposition badge.
  const outcomeLabel = state.disposition ? OUTCOME_LABELS[state.disposition] : 'Qualification';
  const stages = ['Acquired', 'Waitlisted', 'Disclosure read', 'Review submitted', outcomeLabel];
  const currentRank = status ? STATUS_RANK[status] : -1;

  const steps = stages.map((label, i) => {
    const done = currentRank >= 0 && i <= currentRank;
    const active = i === currentRank;
    return `<li class="${done ? 'done' : ''} ${active ? 'active' : ''}">${escapeHtml(label)}</li>`;
  }).join('');

  const dispositionBadge = state.disposition
    ? `<span class="badge ${escapeHtml(state.disposition)}">${escapeHtml(state.disposition)}</span>`
    : '<span class="badge pending">in progress</span>';
  const outcomeBanner = !state.disposition
    ? ''
    : state.disposition === 'qualified'
      ? `<div class="notice ok" role="status"><strong>Qualified.</strong> Two independent next steps are now available: record a business follow-up (the conversion lane) and, separately, offer the optional wallet acknowledgement. Neither depends on the other.</div>`
      : `<div class="notice bad" role="status"><strong>Not qualified.</strong> ${escapeHtml(
          state.disposition === 'duplicate'
            ? `This review matches ${state.duplicateOf ?? 'an earlier review'}; it is recorded but excluded from qualified conversion.`
            : state.disposition === 'abuse_flagged'
              ? 'The participant profile is abuse-flagged; the review is excluded from conversion but stays visible to operations.'
              : `Rejected because ${REASON_LABELS[state.rejectionReason ?? ''] ?? 'a gate failed'}.`,
        )} Business follow-up and wallet acknowledgement are only offered for qualified reviews.</div>`;

  const canWaitlist = !state.viewed && state.participant?.status === 'acquired';
  const canView = state.participant?.status === 'waitlisted';
  const canSubmit = state.participant?.status === 'disclosure_viewed';
  const isQualified = state.disposition === 'qualified';
  const canFollowup = isQualified && state.followUps === 0;
  const walletAvailable = isQualified && !state.prompted;
  const walletConnectable = isQualified && state.prompted && !state.connected && state.walletStatus === 'not_attempted';
  const canAck = isQualified && state.connected && !state.ackAttempted;

  const staleView = state.viewedVersion !== undefined && state.viewedVersion !== CURRENT_DISCLOSURE_VERSION;
  const staleNotice = staleView
    ? `
        <div class="notice warn" role="status">
          <p>You confirmed reading <strong>v${escapeHtml(String(state.viewedVersion))}</strong>, but the current disclosure is <strong>v${CURRENT_DISCLOSURE_VERSION}</strong>. A review submitted now is evaluated against v${escapeHtml(String(state.viewedVersion))} and will fail the version gate.</p>
          <button class="btn" id="live-reread">Re-read current disclosure (v${CURRENT_DISCLOSURE_VERSION})</button>
        </div>`
    : '';

  const reviewForm = state.viewed && !state.submitted
    ? `
      <div class="box">
        ${staleNotice}
        <div class="form-row">
          <label for="review-section">Disclosure section your review references</label>
          <select id="review-section">${SECTION_OPTIONS}</select>
        </div>
        <div class="form-row">
          <label for="review-question">The specific question your review raises</label>
          <input id="review-question" type="text" placeholder="e.g. What key-rotation policy is missing?" />
        </div>
        <div class="form-row">
          <label for="review-why">Why it matters</label>
          <input id="review-why" type="text" placeholder="e.g. The disclosure omits custody details..." />
        </div>
        <p class="muted small">All three fields are required to qualify. Every submission is recorded; the seven gates then decide the outcome.</p>
        <div class="row-actions">
          <button class="btn primary" id="live-submit">Submit review</button>
          <button class="btn" id="live-dup" title="Submits the exact review seed participant U007 already submitted">Submit U007's review (duplicate demo)</button>
        </div>
      </div>`
    : '';

  const followUpPanel = !isQualified
    ? ''
    : canFollowup
    ? `
      <div class="box">
        <h4 class="branch-title">Branch 1 · Business follow-up <span class="muted">(conversion)</span></h4>
        <div class="form-row">
          <label for="followup-type">Follow-up type</label>
          <select id="followup-type">${FOLLOW_UP_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select>
        </div>
        <button class="btn primary" id="live-followup">Record business follow-up</button>
      </div>`
    : `
      <div class="box">
        <h4 class="branch-title">Branch 1 · Business follow-up <span class="muted">(conversion)</span></h4>
        <p class="done-line">✓ Follow-up recorded (${escapeHtml(state.followUpType ?? '')}). This qualified review now counts toward business conversion.</p>
      </div>`;

  const walletPanel = `
    <div class="box">
      <h4 class="branch-title">Branch 2 · On-chain acknowledgement <span class="muted">(optional, simulated)</span></h4>
      <p class="muted">A participation record only. It confers no ownership, reserves, investment, entitlement, or reward, and never affects qualification or follow-up.</p>
      ${walletAvailable ? `<button class="btn primary" id="live-prompt">Prompt wallet</button>` : ''}
      ${walletConnectable ? `
        <div class="row-actions">
          <button class="btn primary" id="live-connect">Connect wallet</button>
          <button class="btn" id="live-decline">Decline</button>
        </div>` : ''}
      ${canAck ? `
        <div class="form-row">
          <label for="ack-outcome">Simulated outcome</label>
          <select id="ack-outcome">
            <option value="success">success</option>
            <option value="failure">failure (SIM_TX_FAILED)</option>
          </select>
        </div>
        <button class="btn primary" id="live-ack">Attempt acknowledgement</button>` : ''}
      <p class="muted">Wallet status: <strong>${escapeHtml(state.walletStatus.replace('_', ' '))}</strong>${
        state.walletStatus === 'failed'
          ? ' — the simulated acknowledgement failed; the review stays qualified.'
          : state.walletStatus === 'declined'
            ? ' — declined; the review stays qualified.'
            : ''
      }</p>
    </div>`;

  const staleToggle = canView
    ? `
    <label class="check-row">
      <input type="checkbox" id="live-stale" />
      <span>Demo only: record that I read the <em>previous</em> version (v1) instead of v${CURRENT_DISCLOSURE_VERSION} — triggers the disclosure-version gate</span>
    </label>`
    : '';

  // Once a review is submitted, the ReviewEvaluated event carries all seven gate
  // results. Surfacing them makes the disposition self-explanatory: a rejected or
  // duplicate review shows exactly which gates passed and which one decided it.
  const gateChecklist = state.checks
    ? `
      <div class="box gate-audit">
        <h4 class="gate-title">Seven qualification gates</h4>
        <p class="muted">All seven gates are evaluated and recorded on every review, so each outcome is auditable.</p>
        <ul class="gate-list">
          ${state.checks
            .map(
              (c) => `
            <li class="gate ${c.passed ? 'pass' : 'fail'}">
              <span class="gate-mark" aria-hidden="true">${c.passed ? '✓' : '✗'}</span>
              <span class="gate-name">${escapeHtml(GATE_LABELS[c.gate] ?? c.gate)}</span>
              <span class="gate-note muted">${escapeHtml(c.note ?? '')}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>`
    : '';

  return `
    <div class="live-head">
      <span class="mono">${escapeHtml(session.id)}</span>
      <span class="muted">${escapeHtml(session.channel)} · ${escapeHtml(session.eligibility)} · ${escapeHtml(session.abuseProfile)}</span>
      ${dispositionBadge}
      <span class="muted">status: ${escapeHtml(status)}</span>
    </div>

    <ol class="steps">${steps}</ol>
    ${outcomeBanner}

    ${canWaitlist ? '<button class="btn primary" id="live-waitlist">Join the waitlist</button>' : ''}

    ${canView ? `
      <div class="box">
        <p class="muted">Read the disclosure (v${CURRENT_DISCLOSURE_VERSION}) further down this page, then confirm.</p>
        ${staleToggle}
        <button class="btn primary" id="live-view">Confirm I read the disclosure</button>
      </div>` : ''}

    ${reviewForm}

    ${gateChecklist}

    ${followUpPanel}
    ${isQualified ? walletPanel : ''}

    <button class="btn ghost" id="live-reset-session">Start another participant</button>
  `;
}

function liveCount(ctx: CommandContext): number {
  return ctx.store.all().reduce((n, e) => (e.type === 'AcquisitionVisited' && e.participantId.startsWith('LIVE-') ? n + 1 : n), 0);
}

function toast(err: unknown): void {
  const message = err instanceof CommandError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
  window.alert(message);
}