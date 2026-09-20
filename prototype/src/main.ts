import type { CommandContext } from '@/commands/context';
import { createContext, nowClock } from '@/commands/context';
import { DISCLOSURE } from '@/data/disclosure';
import { buildSyntheticStore } from '@/seed';
import { renderDashboard } from './dashboard';
import { renderJourney, resetLiveSession } from './journey';

let ctx: CommandContext;

function boot(): void {
  // Regenerate the deterministic synthetic log, then continue it with live
  // events. The dashboard and the journey always read the same store.
  ctx = createContext(buildSyntheticStore(), DISCLOSURE, nowClock);
  resetLiveSession();
  render();
}

function render(): void {
  const journeyView = document.getElementById('journey-view');
  const dashboardView = document.getElementById('dashboard-view');
  if (!journeyView || !dashboardView) return;

  const hash = window.location.hash;
  const showDashboard = hash === '#dashboard';

  journeyView.hidden = showDashboard;
  dashboardView.hidden = !showDashboard;

  if (showDashboard) {
    renderDashboard(dashboardView, ctx);
  } else {
    renderJourney(journeyView, ctx, render);
  }

  document.querySelectorAll<HTMLAnchorElement>('.app-nav a').forEach((link) => {
    const active = link.dataset['view'];
    link.classList.toggle('active', showDashboard ? active === 'dashboard' : active === 'journey');
  });
}

window.addEventListener('hashchange', render);
boot();