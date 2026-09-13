# Formula Builder extension (V1.0C — Phase 3B)

A local Chrome/Chromium side panel for finding, configuring, and copying Smartsheet formulas. The UI is independent of the portfolio site. No installation of Node packages is needed.

## Package and load

From the repository root in PowerShell:

```powershell
npm run package:extension
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated **dist/formula-builder** directory. Pin the extension and click its toolbar action to open the panel. Chrome 114 or later is required; other Chromium browsers must implement Chrome's side-panel API.

After source changes, run the packaging command again, reload the extension on `chrome://extensions`, then reopen the panel. Do not load `extensions/formula-builder` directly: the shared core is added during packaging. Do not edit generated files.

The packager uses Node built-ins and an explicit 17-file allowlist. It copies source bytes without transpiling or bundling. It refuses unexpected entries in an existing output directory instead of deleting them; inspect and move those entries yourself before retrying. `/dist/formula-builder/` is ignored by Git. The README, tests, fixtures, portfolio UI, Schedule Analyzer, and source/reference icon are not shipped.

## Architecture and scope

- `js/formula-builder/` remains the single canonical source for the catalog, utilities, validation, guidance, and engine. All 26 formula types and all 44 generation combinations remain there unchanged.
- The extension-only `theme.js` loads early in the document head. The five shared classic scripts load from packaged `core/`, followed by `formula-discovery.js` and `sidepanel.js`. The application has no build system, runtime dependencies, network requests, or remote executable code.
- Discovery reads the canonical labels, explanations, keywords, and five categories. Search requires every whitespace-separated term to match user-facing metadata, ignores case, and preserves catalog order. Internal IDs and user values are not search terms.
- Extension discovery requires `availability.extension === true` and an exact primitive `libraryId` of `advanced` or `common`. Missing, malformed, or unknown library metadata is excluded without normalization or inference. The current availability metadata excludes `multiLineReportLabel` and `rioIdLookup`: exactly 24 Advanced formulas remain visible in their existing order. Both excluded formulas remain in the shared engine and 26-formula portfolio.
- Phase 3B provides the Advanced/Common discovery foundation with no production Common formulas. Advanced remains the initialization preference even when Common entries arrive later. The native Library radio selector is hidden until both known libraries have extension-available entries; no empty Common library is exposed in production.
- `findFormulas(catalog, categories, query, categoryId, libraryId = "advanced")` filters by surface, library, category, then search. Four-argument callers retain Advanced discovery. Unknown libraries/categories and empty libraries return no matches. The pure `resolveDiscoveryState()` separately recovers UI state: preserve a populated library, otherwise prefer Advanced, then Common, then no selection. Categories follow canonical order and include only categories populated in the selected library, independently of search.
- Library switches preserve the exact raw query and any category supported by the destination; otherwise the category visibly resets to All categories with no per-library memory. Both explicit Clear filters buttons clear query/category, keep the library, and focus search. Library selection alone does not enable Clear. Library state is panel-local and is never persisted or tied to drafts. Back reveals the existing Find DOM without rerendering results, preserving result focus and scroll.
- The DOM adapter keeps raw per-formula drafts in a panel-local Map. Back navigation retains drafts, filters, and the selected discovery item. Closing/reloading the panel or Chrome may destroy drafts. Formula values and drafts are never persisted.
- Generation is live. Required fields and the existing positive-whole-number rank rule are the only validation. Generated formulas are not evaluated against Smartsheet.
- The worker only enables toolbar side-panel toggling. The manifest requests only `sidePanel` and `storage`, has no popup, and retains Chrome's default extension CSP. There are no host permissions, content scripts, page access, or formula injection.
- Clipboard writes happen directly on a user click with `navigator.clipboard.writeText()`. There is no clipboard permission or read access. Rejection selects the formula for manual copy. Feedback is shown only for the current formula revision.
- The five approved Sheet + Formula production PNG icons are supplied assets, copied without alteration at 16, 24, 32, 48, and 128 pixels. The master at `icons/source/formula-builder-icon-option-2-master.png` is retained in the repository for future design/store use and excluded from the runtime package. Do not regenerate or replace these assets during packaging. This identity does not imply official Smartsheet affiliation.

## Appearance

Use the upper-right sun/moon button to toggle dark mode. Its accessible name is **Dark mode**, and its pressed state indicates whether dark mode is active. The panel follows system color preference until you choose light or dark explicitly. Only that choice is saved as the `theme` key in `chrome.storage.local`; it survives panel reloads. System changes no longer override an explicit choice.

Theme changes preserve formula output, input values, drafts, disclosures, scroll, copy feedback, and keyboard focus. The initial storage read cannot override a newer choice, and writes are serialized so rapid toggles finish with the latest selection. A failed write keeps the selected theme active for the session; the toggle tooltip and a separate screen-reader status explain that it could not be saved. A failed read uses the system theme. The early script resolves system preference immediately, but a saved override may appear after the asynchronous read completes.

Formula Modification, accounts, backend services, payments, licensing, telemetry, and persistent history are outside this milestone.

## Tests

```powershell
npm test
```

Existing characterization and portfolio tests are preserved. New tests cover discovery, category/keyword metadata, exclusions, empty-state clearing, draft retention, live rendering against reviewed default/customized fixtures, guidance, validation, focus transitions, literal text rendering, clipboard resolution/failure/stale feedback, worker configuration, manifest restrictions, package paths, exact package contents, and shared-core byte equality. Package tests load all 26 engines from a temporary package and check all 44 reviewed combinations.

V1.0B tests additionally cover result accessibility, decorative chevrons, removal of duplicate branding, saved/system themes, invalid preferences, storage failures, delayed reads, serialized rapid writes, theme-only state changes, semantic palette contrast, and exclusion of the icon master. Native Enter/Space activation and actual accessibility-tree behavior require Chrome checks.

The small DOM double reads the actual side-panel HTML and checks adapter behavior. It does **not** emulate Chrome layout, native control behavior, accessibility-tree announcements, user activation, or extension lifecycle. Passing Node tests does not replace the browser checks below.

Phase 3B uses discovery-only synthetic Common entries from `tests/helpers/formula-discovery-fixtures.js` and a pre-initialization core hook in the test DOM helper. These fixtures are test-only, are never shipped, and have no Common builders. Tests cover strict library metadata, availability, insertion order, state recovery, category transitions, raw search retention, both Clear actions, radio state, theme changes, and Advanced draft/navigation preservation. Synthetic Common discovery interactions never invoke generation. The DOM double does not prove native radio arrow-key behavior.

Run the complete `npm test` suite, including package and portfolio tests, then `npm run package:extension` and `git diff --check`. Package tests verify all 17 allowlisted files against canonical source bytes, exclude test fixtures, and retain all 44 established engine combinations. Perform the Chrome checks below on the regenerated production package before approving a commit.

## Manual Chrome validation before release

1. Load the generated package in Chrome. Confirm there are no manifest, service-worker, console, resource-loading, or CSP errors. Confirm the toolbar opens/toggles the side panel with no popup. Repeat after extension reload and worker suspension/restart.
2. Check Find and Build in both themes at 320, 360, and 420 CSS px, a wider panel, and 200% zoom. Check wrapping titles, native category options, empty results, result scrolling, error/disabled states, contrast, and no horizontal page overflow. Check a short window height, too. Confirm the toggle never overlaps content.
3. Confirm the Library selector is hidden, exactly 24 Advanced results remain, all five categories are available, and keyword search, combined filters, stable order, and both Clear filters buttons work. Confirm absence of the two extension-unavailable formulas. Verify the portfolio still lists all 26 independently and initially selects Append Date to Text.
4. With keyboard only, search/filter/select, tab through all controls, open field help and guidance, change text/options, copy, and return. Verify visible focus, correct labels, no hidden-view tab stops or focus traps, and return focus/scroll. With a screen reader, check result counts, invalid fields, explanation/setup disclosures, and copy announcements.
5. Exercise a short formula, the long longest-word formula, a lookup with nine fields, rank errors, blank required inputs, quoted/custom names, and every selectable option. Check live output and that clearing input disables Copy Formula. Ensure open help and input focus remain stable while typing.
6. Edit two formulas and switch between them; verify raw drafts survive Back and filtering. Reload the panel and verify defaults return. Do not promise drafts survive panel closure or browser lifecycle events.
7. Click Copy Formula, paste into a plain-text editor, and compare exact output (including long formulas). Test consecutive copies and editing/navigating during a pending copy. In side-panel DevTools, temporarily make `navigator.clipboard.writeText` reject to check selectable manual-copy fallback and truthful status; reload afterward. Confirm click-to-copy works without a clipboard permission.
8. Inspect cross-sheet reference names, source columns, setup notes, and usage instructions after editing. Paste representative formulas into a disposable Smartsheet sheet with the named references created manually. This is a user-driven check; the extension never reads or changes the sheet.
9. Confirm local generation works offline and no outgoing requests occur. Open the portfolio separately and smoke-test Formula Builder and Schedule Analyzer.
10. Toggle themes with Enter and Space, including after scrolling and copying. Verify focus stays on the toggle, values/output and copy feedback remain unchanged, and disclosures stay open. Reload to verify the explicit preference. Remove only the `theme` key in DevTools and reload to check system fallback; change OS appearance before making a choice. Check rapid toggles, storage failure feedback, and first-paint appearance. Verify only `theme` is written to extension storage.
11. Inspect the supplied icon at toolbar size on light and dark Chrome backgrounds and on `chrome://extensions`. Confirm the packaged extension contains only the five production PNGs, with no `icons/source` directory.

Optional synthetic Chrome check for Nick/Aetherion review: in side-panel DevTools, set a breakpoint before the core destructuring at the start of `sidepanel.js`, reload the panel, and inject discovery-only Common metadata into `SmartsheetFormulaBuilder.catalog` in memory before resuming. Use an existing category or add a synthetic category to the in-memory category array. This requires no tracked source edits, generated package edits, or production testing hook. Exercise radio keyboard/focus, search, categories, and Clear only; do not open synthetic Common results in Build. Remove the breakpoint and reload to discard the injected state. This method is proposed, not browser-validated in Phase 3B. Automated synthetic tests suffice for this phase; repeat native-radio manual validation when real Common entries become production-visible.

Before Chrome Web Store submission, separately review the listing, privacy disclosures, affiliation wording, final icons/screenshots, and distribution model. No commercial infrastructure is implemented here.
