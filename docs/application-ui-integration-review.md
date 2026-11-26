# Application UI integration review

Reviewed against `main` at `9dd7a2cc4493ee01954d9313e3bc88539d000d64` on 2026-11-26. The merge preserves main's PowerPoint/browser-PDF APIs and loop persistence fixes while retaining the application theme boundary, shared controls, tab hover feedback, compact 32px duration fields and one field-level focus outline.

## Review result

No known blocking findings remain after local review and validation. Merge still requires verifying the pushed PR head, terminal GitHub checks, current base and review discussions.

Integration fixes verified:

- Keep authored slides and error markers in light DOM; keep application controls and popup portals in their private theme. Browser exports mount outside application chrome while retaining the host's React providers.
- Use shared download menus and export dialogs, with nested select popups above the modal and readable option labels. Defer the export dialog and its form controls until export intent/opening. Toolbar menus allow focus to move outside without trapping the user.
- Resolve CLI-owned UI dependencies from the CLI package before prebundling. This prevents missing dependencies, reloads and mixed React dispatchers in fresh or linked deck installs.
- Preserve current main's loop playback configuration, unsaved host drafts, failed-save behavior and same-value host rerenders. Config file saves do not reload the current deck.
- Preserve cancellable Chromium installation and explicit host browser choices; try installed Chrome when the bundled default is absent. New unit cases cover fallback, explicit configuration, crashes and cancellation.

## Validation

- Unit suite: 79 tests, 77 passed, 2 skipped locally because the existing DejaVu Serif fixture paths are Linux-specific; no failures.
- Root and CLI strict TypeScript checks, package/declaration/browser-engine builds, public browser-entry bundling and locked dependency installation passed. Lint has no errors and retains the pre-existing annotation-row semantic-role warning.
- Application browser suite passed hostile global/theme/root-font changes, keyboard/focus, editor draft guards, annotations, mobile/fullscreen portals, real PDF download, authored typography, plain SDK consumers and static print scaling.
- Source editor browser assertions passed saves/conflicts, rich text, geometry, source edits and production exclusion. Its pre-existing retained Node handle required stopping the completed test process.
- Loop suite passed inspector guards, Studio persistence, equivalent host rerenders, failed saves, three playback cycles, pause/visibility/Escape and single-slide restart.
- Real Studio PDF/PowerPoint smoke passed menu navigation/dismissal, reveal options, saved-version guard, file/report downloads, cancellation and focus restoration. PDF error/print fallback and delayed-job cancellation regression checks passed.
- Browser PowerPoint qualification passed six fixtures with four font faces, native/browser checks, parent React context, rerenders during export, sub-path font URLs, mixed legacy/explicit IDs, 50-slide stress export, aborts and cleanup.

## Production size versus current main

Sizes are bytes; gzip level 9 and Brotli quality 11 sum independently compressed emitted files. Initial follows static Vite manifest imports. Embedded application CSS counts as JavaScript. Total includes optional browser export engines already present on main, and all deferred UI chunks.

| Build / scope         |    JS raw |   JS gzip | JS Brotli | CSS raw | CSS gzip | CSS Brotli |
| --------------------- | --------: | --------: | --------: | ------: | -------: | ---------: |
| Main / initial        |   463,904 |   143,988 |   124,061 |  57,413 |   10,001 |      8,428 |
| Combined / initial    |   596,693 |   184,696 |   158,477 |  57,210 |    9,923 |      8,349 |
| Main / all chunks     | 2,957,659 | 1,113,041 |   914,804 |  57,413 |   10,001 |      8,428 |
| Combined / all chunks | 3,248,055 | 1,214,495 | 1,004,390 |  57,210 |    9,923 |      8,349 |

Initial JS is 154.8 KiB Brotli (+27.74% versus main). All JS chunks grow 9.79% Brotli. No editor modules enter production. See [complete size evidence](bundle-measurements/integrated-main.json). The original pre-integration measurement reports remain historical snapshots.

Both variants build in fresh production Node processes using the same deck and CLI entry; the archived main package builds its own optional browser engines. Reproduce with:

```sh
UI_MIGRATION_BASE=9dd7a2cc4493ee01954d9313e3bc88539d000d64 \
UI_MIGRATION_OUT=/tmp/promptslide-integrated-bundles \
UI_MIGRATION_REPORT=docs/bundle-measurements/integrated-main.json \
node packages/cli/test/application-bundle.mjs
```

## Throttled relative performance

Three fresh-context Chrome runs per variant, 390×844 mobile/touch viewport, 4× CPU slowdown, 150ms latency, 200 KiB/s download, independently Brotli-compressed assets and disabled cache. External font CSS is omitted in both variants. These are local emulated comparisons, not physical-phone or field Core Web Vitals measurements.

| Median                        |      Main |  Combined |
| ----------------------------- | --------: | --------: |
| Ready canvas and view trigger | 1283.0 ms | 1527.7 ms |
| First view menu               |   60.9 ms |  391.6 ms |
| First settings panel          |   86.4 ms |  391.7 ms |

See [all samples and conditions](bundle-measurements/integrated-main-performance.json). Reproduce after the size harness with:

```sh
UI_MIGRATION_OUT=/tmp/promptslide-integrated-bundles \
UI_PERFORMANCE_REPORT=docs/bundle-measurements/integrated-main-performance.json \
node packages/cli/test/application-performance.browser.mjs
```
