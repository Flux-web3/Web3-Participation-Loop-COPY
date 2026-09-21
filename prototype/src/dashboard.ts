import type { CommandContext } from '@/commands/context';
import type { FunnelMetrics } from '@/analytics';
import { buildParticipantRows, computeDashboard } from '@/analytics';
import { SYNTHETIC_SEED, buildSyntheticStore } from '@/seed';
import { escapeHtml, pct, rateTitle } from './format';

type RateKey =
  | 'waitlistActivation'
  | 'disclosureEngagement'
  | 'reviewSubmission'
  | 'reviewQualification'
  | 'qualifiedParticipation'
  | 'businessFollowUpConversion'
  | 'acknowledgementSuccess';

/** The five funnel stages, each with the step rate that feeds it. */
const FUNNEL_STAGES: ReadonlyArray<{ count: keyof FunnelMetrics; label: string; rate?: RateKey; rateLabel?: string }> = [
  { count: 'acquisitionEntries', label: 'Acquisition entries' },
  { count: 'waitlistParticipants', label: 'Joined waitlist', rate: 'waitlistActivation', rateLabel: 'of acquisitions' },
  { count: 'disclosureViewers', label: 'Read disclosure', rate: 'disclosureEngagement', rateLabel: 'of waitlist' },
  { count: 'reviewSubmissions', label: 'Submitted review', rate: 'reviewSubmission', rateLabel: 'of readers' },
  { count: 'qualifiedReviews', label: 'Qualified review', rate: 'reviewQualification', rateLabel: 'of submissions' },
];

const OUTCOME_CARDS: ReadonlyArray<{ key: RateKey; label: string; note: string }> = [
  { key: 'reviewQualification', label: 'Review qualification rate', note: 'qualified ÷ submitted reviews (the selected bottleneck)' },
  { key: 'qualifiedParticipation', label: 'Qualified participation', note: 'qualified reviews ÷ eligible participants' },
  { key: 'businessFollowUpConversion', label: 'Business follow-up conversion', note: 'qualified reviews with ≥1 follow-up ÷ qualified reviews' },
];

const WALLET_ORDER = ['not_attempted', 'declined', 'pending', 'success', 'failed'] as const;

/** Number of events the deterministic synthetic seed produces. */
const SEED_EVENT_COUNT = buildSyntheticStore().size();

export function renderDashboard(root: HTMLElement, ctx: CommandContext, onResetToSeed: () => void): void {
  const snapshot = computeDashboard(ctx.store.all());
  const labels = new Map(SYNTHETIC_SEED.map((r) => [r.id, r.label]));
  const sessionEvents = ctx.store.size() - SEED_EVENT_COUNT;

  const funnel = FUNNEL_STAGES.map(({ count, label, rate, rateLabel }) => {
    const r = rate ? snapshot.funnel[rate] : undefined;
    return `
      <div class="card kpi funnel-stage">
        <div class="kpi-label">${escapeHtml(label)}</div>
        <div class="kpi-value">${snapshot.funnel[count]}</div>
        <div class="kpi-raw">${
          r ? `${escapeHtml(pct(r.value))} ${escapeHtml(rateLabel ?? '')} <span title="${escapeHtml(rateTitle(r))}">(${r.numerator}/${r.denominator})</span>` : 'entry point · any channel'
        }</div>
      </div>`;
  }).join('');

  const outcomes = OUTCOME_CARDS.map(({ key, label, note }) => {
    const rate = snapshot.funnel[key];
    return `
      <div class="card kpi">
        <div class="kpi-label">${escapeHtml(label)}</div>
        <div class="kpi-value">${escapeHtml(pct(rate.value))}</div>
        <div class="kpi-raw">${rate.numerator} / ${rate.denominator}</div>
        <div class="kpi-note">${escapeHtml(note)}</div>
      </div>`;
  }).join('');

  const ack = snapshot.funnel.acknowledgementSuccess;

  const channels = snapshot.channels
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.channel)}</td>
        <td>${c.acquisitions}</td>
        <td>${c.waitlistParticipants}</td>
        <td>${c.disclosureViewers}</td>
        <td>${c.reviewSubmissions}</td>
        <td>${c.qualified}</td>
        <td>${c.duplicates}</td>
        <td>${c.abuseFlagged}</td>
      </tr>`,
    )
    .join('');

  const wallet = WALLET_ORDER.map(
    (status) =>
      `<div class="wallet-cell">
        <span class="wallet-count">${snapshot.wallet.statuses[status]}</span>
        <span class="wallet-status">${escapeHtml(status.replace('_', ' '))}</span>
      </div>`,
  ).join('');

  const integrity = [
    snapshot.integrity.duplicatesFlagged === 0
      ? 'no duplicates flagged'
      : `${snapshot.integrity.duplicatesFlagged} duplicate(s): ${snapshot.integrity.duplicateParticipants.join(', ')}`,
    snapshot.integrity.abuseFlagged === 0
      ? 'no abuse flagged'
      : `${snapshot.integrity.abuseFlagged} abuse signal(s): ${snapshot.integrity.abuseParticipants.join(', ')}`,
  ].map(escapeHtml).map((t) => `<li>${t}</li>`).join('');

  const rows = buildParticipantRows(ctx.store.all())
    .map((r) => {
      const label = labels.get(r.id);
      return `
      <tr>
        <td><span class="mono">${escapeHtml(r.id)}</span></td>
        <td>${escapeHtml(label ?? '')}</td>
        <td>${escapeHtml(r.channel)}</td>
        <td>${escapeHtml(r.eligibility)}</td>
        <td>${escapeHtml(r.abuseProfile)}</td>
        <td>${escapeHtml(r.status ?? '')}</td>
        <td>${escapeHtml(r.reviewDisposition ?? '')}</td>
        <td>${escapeHtml(r.rejectionReason ?? '')}</td>
        <td class="mono">${escapeHtml(r.duplicateOfReviewId ?? '')}</td>
        <td class="mono">${escapeHtml(r.reviewId ?? '')}</td>
        <td>${escapeHtml(r.reviewSection ?? '')}</td>
        <td>${escapeHtml(r.walletAckStatus)}</td>
        <td>${r.followUpCount}</td>
      </tr>`;
    })
    .join('');

  root.innerHTML = `
    <h2>Operations Dashboard</h2>
    <div class="log-status">
      <p class="muted">
        Every figure below is derived from the append-only event log: <strong>${ctx.store.size()} events</strong>
        ${sessionEvents > 0
          ? `— the ${SEED_EVENT_COUNT}-event synthetic seed plus ${sessionEvents} added in this session.`
          : `— the synthetic seed baseline.`}
      </p>
      ${sessionEvents > 0 ? '<button class="btn" id="reset-seed">Reset to seed baseline</button>' : ''}
    </div>

    <section aria-label="Participation funnel">
      <h3>Participation funnel</h3>
      <div class="kpi-grid funnel-grid">${funnel}</div>
      <p class="muted small">${snapshot.funnel.eligibleParticipants} of ${snapshot.funnel.acquisitionEntries} acquired participants are eligible. Acquisition channel is attribution only.</p>
    </section>

    <section aria-label="Qualification and business conversion">
      <h3>Qualification &amp; business conversion</h3>
      <div class="kpi-grid outcome-grid">${outcomes}</div>
      <p class="muted small">${snapshot.funnel.followUpsCreated} follow-up(s) recorded. Only qualified reviews can receive a follow-up; wallet activity never counts as conversion.</p>
    </section>

    <section aria-label="Wallet acknowledgement">
      <h3>Wallet acknowledgement <span class="muted">(optional, simulated — separate from the funnel)</span></h3>
      <div class="wallet-grid">${wallet}
        <div class="wallet-cell wallet-rate">
          <span class="wallet-count">${escapeHtml(pct(ack.value))}</span>
          <span class="wallet-status">success rate (${ack.numerator}/${ack.denominator} attempts)</span>
        </div>
      </div>
      <p class="muted small">Declining, failing, or never attempting the acknowledgement does not affect qualification or follow-up.</p>
    </section>

    <div class="two-col">
      <section aria-label="Acquisition channels">
        <h3>Acquisition &amp; attribution</h3>
        <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Channel</th><th>Acquired</th><th>Waitlisted</th><th>Viewed</th>
              <th>Submitted</th><th>Qualified</th><th>Duplicates</th><th>Abuse</th>
            </tr>
          </thead>
          <tbody>${channels}</tbody>
        </table>
        </div>
      </section>

      <section aria-label="Integrity">
        <h3>Integrity signals <span class="muted">(excluded, but visible)</span></h3>
        <ul>${integrity}</ul>
        <p class="muted">
          Duplicates and abuse-flagged reviews stay in the log and in the table below, but never count as
          qualified or converted. Abuse labels are synthetic; this prototype is not a Sybil detector.
        </p>
      </section>
    </div>

    <section aria-label="Participants">
      <h3>Participants (all synthetic)</h3>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Scenario</th><th>Channel</th><th>Eligibility</th><th>Abuse</th>
              <th>Status</th><th>Disposition</th><th>Reason</th><th>Dup of</th>
              <th>Review</th><th>Section</th><th>Wallet</th><th>Follow-ups</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;

  root.querySelector<HTMLButtonElement>('#reset-seed')?.addEventListener('click', onResetToSeed);
}