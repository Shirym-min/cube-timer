# Verification record

Verified on 2026-11-17 with local Chrome and Node.js 24.12.0.

- TypeScript checking and Vite production build passed.
- 15 unit tests passed: trimmed means and rolling bests, DNF/+2, inspection boundaries, time parsing, deterministic operation merging, import validation, csTimer import, CSV formula escaping, multi-blind ranking, legacy hint settings, accent contrast, pagination and failure handling in a mocked sync client, and solver results for all six cross faces and X-cross pairs.
- Production browser checks passed for all 17 WCA events, including large cubes and 2D diagrams.
- Browser flows passed for keyboard timing, manual entry, +2 editing, reload persistence, session isolation, statistics and themes.
- Production PWA tests passed after service-worker activation: offline reload, offline scramble generation, touch hold/release timing, inspection +2, split timing, deletion and 320px reflow.
- Hint tests passed after the requested interaction change: one-click automatic search, anchored non-modal popover, persisted face/type selection, Escape/outside dismissal, optional 3D view and mobile bounds.
- Screenshots were inspected at desktop, tablet and mobile sizes. Screenshots containing timing data use synthetic test entries in isolated browser contexts, not application seed data.
- Dependency installation audit reported zero vulnerabilities after updating the transitive glob version. This is not a full security audit.

## Limits

Supabase URL and publishable key are intentionally unconfigured at the user's request. SQL/RLS and the client are implemented, but authentication email delivery, real cross-device sync and RLS behavior have not been exercised against a provisioned Supabase project. Mocked client tests do not prove those external behaviors.

Physical iPhone installation, Safari/WebKit compatibility, hardware timing accuracy and a complete assistive-technology audit have not been verified. Public deployment has not been performed. Stackmat and Bluetooth hardware integrations are not implemented.

The X-cross solver has a 12-move and 10-second search limit and targets one fixed adjacent F2L pair per selected face. This limit is stated in the implementation and README. Official competition scramble certification is not claimed.
