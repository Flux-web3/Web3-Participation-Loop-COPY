import type { Disclosure, SectionId } from '@/domain';

/**
 * The synthetic disclosure document under review. This is fictional reference
 * data for the assessment prototype — it describes no real project, securities,
 * tokens, rewards, or financial instruments.
 *
 * The current version is 2. A prior version (1) is referenced only so the
 * prototype can demonstrate the disclosure-version-match gate rejecting a review
 * written against a stale version.
 */
export const DISCLOSURE_ID = 'DISC-MUST-1';
export const CURRENT_DISCLOSURE_VERSION = 2;

export const DISCLOSURE: Disclosure = {
  id: DISCLOSURE_ID,
  version: CURRENT_DISCLOSURE_VERSION,
  title: 'MUST Company — Community Project Disclosure (Synthetic)',
  sections: [
    {
      id: 'overview',
      title: 'Project Overview',
      body:
        'MUST Company operates a fictional community program used here purely to demonstrate a ' +
        'participation-review loop. This document is synthetic and exists only to be reviewed inside ' +
        'the prototype. Nothing in it is an offer, solicitation, or description of a real product.',
    },
    {
      id: 'treasury',
      title: 'Treasury & Custody',
      body:
        'The program describes a simulated treasury held under a multi-signature arrangement. The ' +
        'disclosure names the signer count but does not describe signer independence, key-rotation ' +
        'policy, or what happens if a signer is unavailable — deliberate gaps for reviewers to surface.',
    },
    {
      id: 'governance',
      title: 'Governance & Decision Rights',
      body:
        'Decisions are described as being made by a core team with community input. The disclosure ' +
        'does not specify how community input is weighted, how proposals are ratified, or how conflicts ' +
        'of interest are handled. Participation confers no ownership, voting entitlement, or control.',
    },
    {
      id: 'risk_factors',
      title: 'Risk Factors',
      body:
        'The program lists generic risks (execution, dependency, timeline) but omits concrete ' +
        'mitigations and does not quantify exposure. A strong review identifies a specific unstated ' +
        'risk or an assumption the disclosure leaves unsupported.',
    },
    {
      id: 'roadmap',
      title: 'Roadmap & Milestones',
      body:
        'Milestones are described qualitatively without dates, acceptance criteria, or dependencies ' +
        'between them. The disclosure does not state how progress is verified or what constitutes a ' +
        'missed milestone.',
    },
    {
      id: 'participation',
      title: 'Participation Model',
      body:
        'Participation means joining a waitlist, reading this disclosure, and submitting a substantive ' +
        'review. There is no token, airdrop, yield, guaranteed reward, investment, or ownership of any ' +
        'kind. Any on-chain acknowledgement offered later is simulated, optional, and confers nothing.',
    },
  ],
  disclaimer:
    'Fictional, synthetic disclosure for an assessment prototype. No real project, securities, ' +
    'tokens, rewards, or financial instruments are described or offered. On-chain acknowledgement is ' +
    'simulated and confers no ownership, reserves, investment, entitlement, or guaranteed reward.',
};

/** Section ids of the current disclosure, for the section-reference gate. */
export const DISCLOSURE_SECTION_IDS: readonly SectionId[] = DISCLOSURE.sections.map((s) => s.id);
