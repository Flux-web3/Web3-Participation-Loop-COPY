import type { CommandContext } from '@/commands/context';
import type { FunnelMetrics } from '@/analytics';
import { buildParticipantRows, computeDashboard } from '@/analytics';
import { SYNTHETIC_SEED } from '@/seed';
import { escapeHtml, pct, rateTitle } from './format';

type RateKey =
  | 'waitlistActivation'
  | 'disclosureEngagement'
  | 'reviewSubmission'
  | 'reviewQualification'
  | 'qualifiedParticipation'
  | 'businessFollowUpConversion'
  | 'acknowledgementSuccess';

const RATE_CARDS: ReadonlyArray<{ key: RateKey; label: string }> = [
  { key: 'waitlistActivation', label: 'Waitlist Activation' },
  { key: 'disclosureEngagement', label: 'Disclosure Engagement' },
  { key: 'reviewSubmission', label: 'Review Submission' },
  { key: 'reviewQualification', label: 'Review Qualification' },
  { key: 'qualifiedParticipation', label: 'Qualified Participation' },
  { key: 'businessFollowUpConversion', label: 'Business Follow-up Conversion' },
  { key: 'acknowledgementSuccess', label: 'Acknowledgement Success' },
];

const STAT_CELLS: ReadonlyArray<{ key: keyof FunnelMetrics; label: string }> = [
  { key: 'acquisitionEntries', label: 'Acquisition entries' },
  { key: 'waitlistParticipants', label: 'Waitlist participants' },
  { key: 'disclosureViewers', label: 'Disclosure viewers' },
  { key: 'reviewSubmissions', label: 'Review submissions' },
  { key: 'qualifiedReviews', label: 'Qualified reviews' },
  { key: 'eligibleParticipants', label: 'Eligible participants' },
  { key: 'followUpsCreated', label: 'Follow-ups created' },
  { key: 'qualifiedReviewsWithFollowUp', label: 'Qualified reviews with follow-up' },
  { key: 'acknowledgementAttempts', label: 'Acknowledgement attempts' },
  { key: 'acknowledgementSucceeded', label: 'Acknowledgements succeeded' },
];

const WALLET_ORDER = ['not_attempted', 'declined', 'pending', 'success', 'failed'] as const;

export function renderDashboard(root: HTMLElement, ctx: CommandContext): void {
  const snapshot = computeDashboard(ctx.store.all());
  const labels = new Map(SYNTHETIC_SEED.map((r) => [r.id, r.label]));

  const rateCards = RATE_CARDS.map(({ key, label }) => {
    const rate = snapshot.funnel[key];
    return `
      <div class="card kpi">
        <div class="kpi-label">${escapeHtml(label)}</div>
        <div class="kpi-value">${escapeHtml(pct(rate.value))}</div>
        <div class="kpi-raw" title="${escapeHtml(rateTitle(rate))}">${escapeHtml(
          `${rate.numerator} / ${rate.denominator}`,
        )}</div>
      </div>`;
  }).join('');

  const stats = STAT_CELLS.map(
    ({ key, label }) =>
      `<div class="stat"><span class="stat-value">${snapshot.funnel[key]}</span><span class="stat-label">${escapeHtml(
        label,
      )}</span></div>`,
  ).join('');

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
        <span class="wallet-status">${escapeHtml(status)}</span>
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
    <p class="muted">
      All metrics are projected from the append-only event log (${ctx.store.size()} events).
      Rates use the directive-fixed denominators. Wallet acknowledgement is a disjoint,
      optional side-channel and never influences the funnel.
    </p>

    <section aria-label="Funnel rates">
      <h3>Funnel &amp; business conversion</h3>
      <div class="kpi-grid">${rateCards}</div>
      <div class="stat-grid">${stats}</div>
    </section>

    <section aria-label="Wallet acknowledgement">
      <h3>Wallet acknowledgement (optional, simulated)</h3>
      <div class="wallet-grid">${wallet}</div>
      <p class="muted">
        ${snapshot.wallet.attempts} attempt(s), ${snapshot.wallet.successful} succeeded.
        Declining or not attempting never blocks qualification.
      </p>
    </section>

    <div class="two-col">
      <section aria-label="Acquisition channels">
        <h3>Acquisition &amp; attribution</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Channel</th><th>Acquired</th><th>Waitlisted</th><th>Viewed</th>
              <th>Submitted</th><th>Qualified</th><th>Duplicates</th><th>Abuse</th>
            </tr>
          </thead>
          <tbody>${channels}</tbody>
        </table>
      </section>

      <section aria-label="Integrity">
        <h3>Integrity signals</h3>
        <ul>${integrity}</ul>
        <p class="muted">
          Labels come from the synthetic seed; the prototype is not a Sybil detector.
          Duplicates and abuse are visible to operations but never increase conversion.
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
              <th>Review</th><th>Section</th><th>Wallet</th><th>F/U</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}