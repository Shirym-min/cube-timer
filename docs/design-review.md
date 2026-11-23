# Design and motion review

## Design direction

SPLIT is a repeated-use timing workspace for cubers, not a landing page. The timer is the central input surface, with the current scramble above it, records beside it, and the diagram and graph below it. On mobile, records move to a separate tab and navigation moves to the bottom. Small viewports retain document scrolling.

The palette uses paper white `#ffffff`, cool gray `#f5f7fb`, navy `#202b40`, muted slate `#65718a`, cobalt `#2459e0`, and success green `#188561`. Cube sticker colors are reserved for the puzzle itself. Accent text is adjusted for contrast in both themes; button foreground is selected independently.

Space Grotesk gives the timer its shape, while system Japanese fonts keep controls compact. DM Mono is used for move notation and comparable numeric records. The timer deliberately gives seconds greater visual weight than milliseconds. This is the signature element; the surrounding panes use flat surfaces and fine dividers.

The initial layout was checked against the risk of turning an app into a set of dashboard cards. Statistics became an unboxed row, graph and diagram share a divided lower region, and headings have no redundant subtitles. There is no introductory hero or decorative animation.

## Animation opportunities

The requested find-animation-opportunities skill was used as a read-only review. These are proposals, not implemented changes.

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/App.tsx`, toast | Notifications appear immediately | Preventing a jarring change | Occasional, after copying or deleting | Enter from `opacity: 0; transform: translate(-50%, 4px)` to `opacity: 1; transform: translate(-50%, 0)`, `160ms cubic-bezier(0.23, 1, 0.32, 1)`; reverse on exit. Reduced motion: opacity only, 80ms. Nonblocking feedback passes the function test. |
| 2 | `src/components/Modal.tsx`, dialog | Settings and account dialogs appear immediately | Spatial consistency | Occasional pointer/touch actions | For pointer/touch opening only: `opacity: 0; transform: scale(.98)` to settled, `180ms cubic-bezier(0.23, 1, 0.32, 1)`; centered origin. Reduced motion: opacity only, 80ms. Keyboard-triggered opening remains immediate. No interaction waits for the transition. |

## Rejected candidates

- `src/components/TimerStage.tsx`, timer input and digits: rejected by frequency. These are repeated keyboard and touch operations; motion would add delay to the core task.
- `src/components/Chart.tsx`, graph line: rejected by function. The graph communicates measured values, so line drawing would delay reading without explaining new information.
- `src/App.tsx`, records and navigation: rejected by frequency. New records and repeated session navigation should appear immediately.
- `src/components/Account.tsx`, login tabs: rejected because the small change is already clear from selected styling; extra motion adds no useful purpose.

The interface needs very little motion. The toast is the strongest candidate, but static feedback is already functional. To implement the proposal separately, use `improve-animations plan toast entrance and exit`. The app adds no animation dependency. Cross hints use an anchored native popover, open and solve in one click, and keep face/type selection in Settings. This frequently used hint surface stays unanimated. The cube player's playback is a user-requested explanation of the solution, not decoration.

## Rendered review

Screenshots were inspected at 1440×960, 820×1180, and 390×844, including populated and empty states and light/dark themes. Navigation, timer entry, record editing, session switching, graph, and the scramble diagram were exercised. A separate production test covers 320px reflow and touch input.

A real browser test found that a production Worker imported DOM initialization through a shared bundle. `vite.config.ts` isolates cubing.js chunks by entry and disables DOM module preloading. This required production-browser verification; a successful build alone had not detected the failure.

The custom accent calculation is tested against contrast ratios. A complete screen-reader audit, physical iPhone installation, and real Supabase authentication are not claimed.
