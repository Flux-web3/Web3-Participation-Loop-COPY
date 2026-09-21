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

export function resetLiveSession(): void {
  live = undefined;
  scenarioCounters = {};
}

interface Scenario {
  id: string;
  title: string;
  blurb: string;
  build: () => SyntheticSeedRecord;
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
    blurb: 'Walks the canonical journey to qualification and a simulated acknowledged acknowledgement.',
    build: () => ({
      id: `DEMO-A${(scenarioCounters.A = (scenarioCounters.A ?? 0) + 1)}`,
      label: 'demo_normal_qualified',
      channel: 'direct',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: HAPPY_PATH_CONTENT },
        { step: 'followup', followUpType: 'intro_call' },
        { step: 'wallet.connect' },
        { step: 'wallet.ack', outcome: 'success' },
      ],
    }),
  },
  {
    id: 'B',
    title: 'Wallet declined participant',
    blurb: 'A qualified review whose participant opts out of the optional wallet acknowledgement.',
    build: () => ({
      id: `DEMO-B${(scenarioCounters.B = (scenarioCounters.B ?? 0) + 1)}`,
      label: 'demo_wallet_declined',
      channel: 'community',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: WALLET_DECLINED_CONTENT },
        { step: 'wallet.decline' },
      ],
    }),
  },
  {
    id: 'C',
    title: 'Duplicate submission',
    blurb: 'Reposts the seed participant U007 review verbatim; the hash matcher flags a duplicate against R-U007-1.',
    build: () => ({
      id: `DEMO-C${(scenarioCounters.C = (scenarioCounters.C ?? 0) + 1)}`,
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
    blurb: 'Qualifies, connects a wallet, and the simulated acknowledgement fails with an error.',
    build: () => ({
      id: `DEMO-D${(scenarioCounters.D = (scenarioCounters.D ?? 0) + 1)}`,
      label: 'demo_ack_failed',
      channel: 'partner',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [
        { step: 'waitlist' },
        { step: 'view' },
        { step: 'submit', content: ACK_FAIL_CONTENT },
        { step: 'wallet.connect' },
        { step: 'wallet.ack', outcome: 'failure' },
      ],
    }),
  },
  {
    id: 'E',
    title: 'Invalid review',
    blurb: 'A boilerplate response is rejected as non-substantive by the quality gates.',
    build: () => ({
      id: `DEMO-E${(scenarioCounters.E = (scenarioCounters.E ?? 0) + 1)}`,
      label: 'demo_invalid_review',
      channel: 'campaign',
      eligibility: 'eligible',
      abuseProfile: 'clean',
      journey: [{ step: 'waitlist' }, { step: 'view' }, { step: 'submit', content: { section: 'overview', question: 'Looks good', whyItMatters: '' } }],
    }),
  },
  {
    id: 'F',
    title: 'Abuse / bot profile',
    blurb: 'A synthetic-bot participant is flagged at the integrity gate.',
    build: () => ({
      id: `DEMO-F${(scenarioCounters.F = (scenarioCounters.F ?? 0) + 1)}`,
      label: 'demo_abuse_bot',
      channel: 'other',
      eligibility: 'eligible',
      abuseProfile: 'synthetic_bot',
      journey: [{ step: 'waitlist' }, { step: 'view' }, { step: 'submit', content: ABUSE_BOT_CONTENT }],
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
  followUps: number;
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
    followUps: events.filter((e) => e.type === 'BusinessFollowUpCreated').length,
    prompted: events.some((e) => e.type === 'WalletPrompted'),
    connected: events.some((e) => e.type === 'WalletConnected'),
    ackAttempted: events.some((e) => e.type === 'WalletAcknowledgementAttempted'),
    checks: events.find(
      (e): e is Extract<DomainEvent, { type: 'ReviewEvaluated' }> => e.type === 'ReviewEvaluated',
    )?.checks,
  };
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
      <button class="btn" data-action="scenario" data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title)}">Run scenario ${escapeHtml(s.id)}</button>
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
      Follow a participant through the canonical loop —
      acquisition → waitlist → disclosure → review → qualification,
      then the diverging business follow-up and optional (simulated) wallet acknowledgement.
      Everything you do here appends real events to the same log the dashboard reads.
    </p>

    <div class="two-col journey-cols">
      <section aria-label="Live interactive journey">
        <div class="card">
          <h3>Live journey <span class="muted">(${ctx.store.size()} events in log)</span></h3>
          ${livePanel}
        </div>
      </section>

      <section aria-label="Scripted demo scenarios">
        <h3>Scripted demo scenarios</h3>
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
      <ol class="event-log mono">${log}</ol>
    </section>
  `;

  root.querySelectorAll<HTMLButtonElement>('button[data-action="scenario"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scenario = DEMO_SCENARIOS.find((s) => s.id === btn.dataset.id);
      if (!scenario) return;
      try {
        playJourney(ctx, scenario.build());
        refresh();
      } catch (err) {
        toast(err);
        refresh();
      }
    });
  });

  wireLiveActions(root, ctx, refresh);
}

function renderNewParticipant(ctx: CommandContext, refresh: () => void): string {
  void ctx; void refresh;
  return `
    <p class="muted">Start a new synthetic participant and step them through the loop. The participant id, channel, eligibility and abuse profile are minted once at acquisition and cannot be changed.</p>
    <div class="form-row">
      <label for="live-channel">Channel</label>
      <select id="live-channel">${CHANNEL_OPTIONS}</select>
    </div>
    <div class="form-row">
      <label for="live-eligibility">Eligibility profile</label>
      <select id="live-eligibility">
        <option value="eligible">eligible</option>
        <option value="ineligible">ineligible (will be rejected at qualification)</option>
      </select>
    </div>
    <div class="form-row">
      <label for="live-abuse">Abuse profile</label>
      <select id="live-abuse">
        <option value="clean">clean</option>
        <option value="synthetic_bot">synthetic_bot (flagged at integrity gate)</option>
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
        resetLiveSession();
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
  const outcomeLabel = state.disposition ?? 'outcome';
  const stages = ['acquired', 'waitlisted', 'disclosure_viewed', 'review_submitted', outcomeLabel];
  const currentRank = status ? STATUS_RANK[status] : -1;

  const steps = stages.map((label, i) => {
    const done = currentRank >= 0 && i <= currentRank;
    const active = i === currentRank;
    return `<li class="${done ? 'done' : ''} ${active ? 'active' : ''}">${escapeHtml(label)}</li>`;
  }).join('');

  const dispositionBadge = state.disposition
    ? `<span class="badge ${escapeHtml(state.disposition)}">${escapeHtml(state.disposition)}</span>`
    : '<span class="badge pending">in progress</span>';

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
        <div class="row-actions">
          <button class="btn primary" id="live-submit">Submit review</button>
          <button class="btn" id="live-dup" title="Copy the exact content U007 submitted">Paste U007 duplicate</button>
        </div>
      </div>`
    : '';

  const followUpPanel = canFollowup
    ? `
      <div class="box">
        <div class="form-row">
          <label for="followup-type">Follow-up type</label>
          <select id="followup-type">${FOLLOW_UP_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select>
        </div>
        <button class="btn primary" id="live-followup">Create business follow-up</button>
      </div>`
    : '';

  const walletPanel = `
    <div class="box">
      <p class="muted">Optional simulated on-chain acknowledgement. It confers nothing and never affects qualification.</p>
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
      <p class="muted">Wallet status: <strong>${escapeHtml(state.walletStatus)}</strong></p>
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
        <p class="muted">Every gate is evaluated and recorded on the review. The disposition above is the highest-precedence failure — all seven results are retained, so even a rejected review shows which gates passed.</p>
        <ul class="gate-list">
          ${state.checks
            .map(
              (c) => `
            <li class="gate ${c.passed ? 'pass' : 'fail'}">
              <span class="gate-mark" aria-hidden="true">${c.passed ? '✓' : '✗'}</span>
              <span class="gate-name mono">${escapeHtml(c.gate)}</span>
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

    ${canWaitlist ? '<button class="btn primary" id="live-waitlist">Join the waitlist</button>' : ''}

    ${canView ? `
      <div class="box">
        <p class="muted">Read every section above, then confirm.</p>
        ${staleToggle}
        <button class="btn primary" id="live-view">Confirm I read the disclosure</button>
      </div>` : ''}

    ${reviewForm}

    ${gateChecklist}

    ${followUpPanel}
    ${isQualified ? walletPanel : ''}

    <button class="btn ghost" id="live-reset-session">Reset live session (keeps log)</button>
  `;
}

function liveCount(ctx: CommandContext): number {
  return ctx.store.all().reduce((n, e) => (e.type === 'AcquisitionVisited' && e.participantId.startsWith('LIVE-') ? n + 1 : n), 0);
}

function toast(err: unknown): void {
  const message = err instanceof CommandError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
  window.alert(message);
}