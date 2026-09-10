# Formula Builder extension (V1 milestone)

A local Chrome/Chromium side panel for finding, configuring, and copying Smartsheet formulas. The UI is independent of the portfolio site. No installation of Node packages is needed.

## Package and load

From the repository root in PowerShell:

```powershell
npm run package:extension
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated **dist/formula-builder** directory. Pin the extension and click its toolbar action to open the panel. Chrome 114 or later is required; other Chromium browsers must implement Chrome's side-panel API.

After source changes, run the packaging command again, reload the extension on `chrome://extensions`, then reopen the panel. Do not load `extensions/formula-builder` directly: the shared core is added during packaging. Do not edit generated files.

The packager uses Node built-ins and an explicit 15-file allowlist. It copies source bytes without transpiling or bundling. It refuses unexpected entries in an existing output directory instead of deleting them; inspect and move those entries yourself before retrying. `/dist/formula-builder/` is ignored by Git. The README, tests, fixtures, portfolio UI, and Schedule Analyzer are not shipped.

## Architecture and scope

- `js/formula-builder/` remains the single canonical source for the catalog, utilities, validation, guidance, and engine. All 26 formula types and all 44 generation combinations remain there unchanged.
- The five shared classic scripts load from packaged `core/`, followed by `formula-discovery.js` and `sidepanel.js`. The application has no build system, runtime dependencies, network requests, or remote executable code.
- Discovery reads the canonical labels, explanations, keywords, and five categories. Search requires every whitespace-separated term to match user-facing metadata, ignores case, and preserves catalog order. Internal IDs and user values are not search terms.
- Only extension discovery excludes `multiLineReportLabel` and `rioIdLookup`: 24 formulas are visible. Both excluded formulas remain in the shared engine and portfolio.
- The DOM adapter keeps raw per-formula drafts in a panel-local Map. Back navigation retains drafts, filters, and the selected discovery item. Closing/reloading the panel or Chrome may destroy drafts. There is no persistent storage.
- Generation is live. Required fields and the existing positive-whole-number rank rule are the only validation. Generated formulas are not evaluated against Smartsheet.
- The worker only enables toolbar side-panel toggling. The manifest requests only `sidePanel`, has no popup, and retains Chrome's default extension CSP. There are no host permissions, content scripts, page access, or formula injection.
- Clipboard writes happen directly on a user click with `navigator.clipboard.writeText()`. There is no clipboard permission or read access. Rejection selects the formula for manual copy. Feedback is shown only for the current formula revision.
- The blue equals-sign icons are original, provisional shell artwork, not Smartsheet branding. Store listing assets and final branding are a later review.

Formula Modification, accounts, backend services, payments, licensing, telemetry, and persistent history are outside this milestone.

## Tests

```powershell
npm test
```

Existing characterization and portfolio tests are preserved. New tests cover discovery, category/keyword metadata, exclusions, empty-state clearing, draft retention, live rendering against reviewed default/customized fixtures, guidance, validation, focus transitions, literal text rendering, clipboard resolution/failure/stale feedback, worker configuration, manifest restrictions, package paths, exact package contents, and shared-core byte equality. Package tests load all 26 engines from a temporary package and check all 44 reviewed combinations.

The small DOM double reads the actual side-panel HTML and checks adapter behavior. It does **not** emulate Chrome layout, native control behavior, accessibility-tree announcements, user activation, or extension lifecycle. Passing Node tests does not replace the browser checks below.

## Manual Chrome validation before release

1. Load the generated package in Chrome. Confirm there are no manifest, service-worker, console, resource-loading, or CSP errors. Confirm the toolbar opens/toggles the side panel with no popup. Repeat after extension reload and worker suspension/restart.
2. Check Find at 320, 360, and 420 CSS px, a wider panel, and 200% zoom. Check long labels, native category options, empty results, result scrolling, contrast, and no horizontal page overflow. Check a short window height, too.
3. Confirm 24 results, all five categories, keyword aliases, combined filters, stable order, both Clear filters buttons, and absence of the two excluded formulas. Verify the portfolio still lists all 26 independently.
4. With keyboard only, search/filter/select, tab through all controls, open field help and guidance, change text/options, copy, and return. Verify visible focus, correct labels, no hidden-view tab stops or focus traps, and return focus/scroll. With a screen reader, check result counts, invalid fields, explanation/setup disclosures, and copy announcements.
5. Exercise a short formula, the long longest-word formula, a lookup with nine fields, rank errors, blank required inputs, quoted/custom names, and every selectable option. Check live output and that clearing input disables Copy Formula. Ensure open help and input focus remain stable while typing.
6. Edit two formulas and switch between them; verify raw drafts survive Back and filtering. Reload the panel and verify defaults return. Do not promise drafts survive panel closure or browser lifecycle events.
7. Click Copy Formula, paste into a plain-text editor, and compare exact output (including long formulas). Test consecutive copies and editing/navigating during a pending copy. In side-panel DevTools, temporarily make `navigator.clipboard.writeText` reject to check selectable manual-copy fallback and truthful status; reload afterward. Confirm click-to-copy works with only `sidePanel` permission.
8. Inspect cross-sheet reference names, source columns, setup notes, and usage instructions after editing. Paste representative formulas into a disposable Smartsheet sheet with the named references created manually. This is a user-driven check; the extension never reads or changes the sheet.
9. Confirm local generation works offline and no outgoing requests occur. Open the portfolio separately and smoke-test Formula Builder and Schedule Analyzer.

Before Chrome Web Store submission, separately review the listing, privacy disclosures, affiliation wording, final icons/screenshots, and distribution model. No commercial infrastructure is implemented here.
