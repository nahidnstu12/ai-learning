import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/** Minimal sidebar for Phase 1 / 2; other files under `docs/` are still published when linked. */
const sidebars: SidebarsConfig = {
  learningSidebar: [
    'scopes/intro',
    'scopes/phase1',
    'scopes/phase2',
  ],
};

export default sidebars;
