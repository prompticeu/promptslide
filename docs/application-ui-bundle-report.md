# Application UI migration: final measurements

The full application migration is implemented on `feat/app-design-system`. The user approved proceeding after the historical feasibility probe exceeded its original 15% compressed-JavaScript gate. The final increase still exceeds that gate; this report records the actual tradeoff rather than treating deferral as a reduction in total shipped code.

Viewer/editor controls share the local Base UI components and private application theme. Authored slides retain their own theme and light-DOM content. Editor modules and source-write endpoints remain development-only. Settings, comments, annotation entry, menu bodies and tooltip positioners load on demand. See [the implementation guide](application-ui.md).

## Production assets

All sizes are **bytes**. Raw means emitted/minified code. gzip uses level 9 and Brotli quality 11; multi-file totals sum independently compressed responses. Initial follows the Vite manifest static import graph and excludes dynamic imports. The application stylesheet is embedded in JavaScript and is included in the JS totals. CSS below is the separate authored deck stylesheet. Public images, font responses and HTML are outside these JS/CSS figures.

| Build / scope                        |  JS raw | JS gzip | JS Brotli | CSS raw | CSS gzip | CSS Brotli |
| ------------------------------------ | ------: | ------: | --------: | ------: | -------: | ---------: |
| Feature baseline / initial and total | 441,521 | 136,862 |   118,461 |  54,753 |    9,514 |      8,088 |
| Migration / initial                  | 583,091 | 180,853 |   155,145 |  54,938 |    9,540 |      8,073 |
| Migration / all emitted chunks       | 696,899 | 224,722 |   194,655 |  54,938 |    9,540 |      8,073 |

| JavaScript increase |                Raw |              gzip |            Brotli |
| ------------------- | -----------------: | ----------------: | ----------------: |
| Initial             | +141,570 (+32.06%) | +43,991 (+32.14%) | +36,684 (+30.97%) |
| Total               | +255,378 (+57.84%) | +87,860 (+64.20%) | +76,194 (+64.32%) |

Initial JS is 151.5 KiB Brotli; all emitted JS is 190.1 KiB. Initial JS plus CSS is 159.4 KiB Brotli. The extra deferred chunks are a real first-use cost and remain in total assets.

Both builds run in fresh Node processes with `NODE_ENV=production`, the same deck, loop config, CLI entry and Vite production defaults. The baseline is a temporary archive of `6dc2f38` using the locked dependencies; the current build uses this checkout. No bundler manual-chunk override or synthetic component gallery is used. The harness finds **zero `/src/editor/` modules** in either production bundle. The final ordinary CLI build reproduces the migration asset names and bytes.

The historical probe recorded baseline CSS as 57,800 raw / 9,676 gzip / 8,182 Brotli bytes. This fresh archived comparison yields 54,753 / 9,514 / 8,088. That is a different Tailwind source-scan context: the archive contains the tracked feature snapshot, while the historical local run also contained local experiment artifacts. Baseline JavaScript is identical in both measurements (441,521 / 136,862 / 118,461). Historical `baseline.json` and `final.json` are retained as earlier evidence; the completed migration is recorded in `migration.json`.

Reproduce after building the package:

```sh
bun run --cwd packages/cli build
node packages/cli/test/application-bundle.mjs
NODE_ENV=production bun run build
```

The harness writes [migration.json](bundle-measurements/migration.json) and static builds under `/tmp/promptslide-application-bundles`. It uses the preserved local baseline commit and must run from a checkout containing that commit.

## Throttled relative performance

Installed Chrome, mobile/touch viewport 390×844, CPU slowdown 4×, 150ms network latency, 200 KiB/s download and 128 KiB/s upload. Each of three samples uses a fresh browser context and disabled HTTP cache. Both variants receive independently Brotli-compressed files over local HTTP. Files are precompressed outside measured navigation. External font CSS is fulfilled empty in both variants to isolate application resources.

| Median of three samples                     |   Baseline |  Migration |    Change |
| ------------------------------------------- | ---------: | ---------: | --------: |
| Navigation to ready canvas and view trigger | 1,214.1 ms | 1,450.6 ms | +236.5 ms |
| Browser ScriptDuration at readiness         |   118.9 ms |   169.6 ms |  +50.7 ms |
| First view menu, touch to visible           |    57.6 ms |   385.4 ms | +327.8 ms |
| First settings panel, touch to visible      |    92.1 ms |   388.7 ms | +296.6 ms |

The migration cold-start median is about 0.24s slower (+19.5%). Its first menu is about 0.39s and first settings panel about 0.39s. The slowest migration sample for these first interactions was about 0.42s. These results support usability under these specific conditions, while showing the cost of fetching deferred components. Desktop hover/focus can preload popup code; the touch measurement does not assume that benefit.

These are relative local measurements with emulated CPU/network conditions, not field Core Web Vitals or results from a physical phone. Three samples do not establish a general performance guarantee. Full samples and conditions are in [performance.json](bundle-measurements/performance.json). Run `node packages/cli/test/application-performance.browser.mjs` after the bundle harness to reproduce.

## Functional verification

- Root and CLI TypeScript checks, the package/declaration build, the ordinary production build and all 29 unit tests passed. Lint has no errors and retains the existing annotation-row semantic-role warning.
- The application browser suite passed hostile global styles and live theme changes (including root font-size), shared orange/white states, keyboard/focus behavior, the separate editor React root, Save/Discard/Keep editing, annotation persistence and mobile popup size, fullscreen, a real PDF download, original slide typography in export, and static print scaling. It also built and used the published SDK in plain Vite with no application CSS/Tailwind/shadcn setup. See [application-browser.json](bundle-measurements/application-browser.json).
- The editor regression suite passed source saves/conflicts, rich text, geometry, images, structural edits, reveal/navigation drafts, runtime-error capture, exposed-server disabling and production exclusion. As in the earlier baseline, its completed Node process retained a handle and was terminated after all assertions.
- The loop browser suite verifies shared inspector drafts and guarded switching, persisted settings in a fresh page, three playback cycles, final-state dwell, exclusion, pause, visibility, Escape and a single included slide. Config writes now invalidate the virtual entry for future loads without reloading the live presentation.

No package was published and no deployment or Registry data was changed.
