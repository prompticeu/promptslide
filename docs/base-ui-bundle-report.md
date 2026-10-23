# Base UI application component migration: historical feasibility probe

**Status:** The user subsequently approved the larger bundle tradeoff and the application migration was implemented. See [the completed migration measurements](application-ui-bundle-report.md) and [the implementation guide](application-ui.md). The observations below describe the earlier experiment at `d2dc75a`, not the current application. Reproduce the final comparison with `application-bundle.mjs`; the historical probe harness targets that earlier checkout.

At this experiment stage, the broad migration was **not rolled out**. The representative production probe exceeds the budget stated before implementation: at most **15% additional gzip/Brotli viewer JavaScript**, for both initial loading and total shipped code. The CSS allowance was an additional 10 KiB gzip. The actual replacement probe adds **56,318 bytes gzip (+41.15%)** and **47,403 bytes Brotli (+40.02%)** for just the view menu, toolbar actions/tooltips, and loop checkbox.

Deferring popup controls keeps the initial increase small, but the full viewer probe still ships roughly 44% more compressed JavaScript. This is a material tradeoff under the requested measurement gate. Acceptance of that tradeoff is needed before proceeding with the broad migration.

## Preserved inputs

- Source base: `d6512fdacde5fd332b3d42323407d0c86937cc87`.
- Supplied binary patch SHA-256: `7c270f29a46a0511008837b6e61d1a1d5e166daf6ad5c2059dd2e5d7265f024e`; verified, checked, and applied once on the recorded base.
- Baseline snapshot: `6dc2f38` on `feat/app-design-system`.
- The originating worktree and the separate Registry checkout were not modified.
- Application sources, authored slides, SDK exports, and skill guidance remain identical to the snapshot. Only test infrastructure, a retained experiment, and development dependencies change.
- The final ordinary `bun run build` has exactly the same JS/CSS asset names and bytes as the original baseline. See `baseline.json` and `final.json`.

## Method

Node 22.13.1, macOS arm64, Vite 6.4.1, React 19.2.4, Tailwind 4.2.1 (locked installation), Base UI 1.9.0 and class-variance-authority 0.7.1. Check the lockfile for complete dependency resolution. Each variant runs in a fresh Node process using the existing production Vite configuration, same deck and loop config, default minification and target. Fresh processes avoid Tailwind's in-process compilation cache affecting subsequent CSS output. The harness baseline matches the ordinary CLI build byte for byte.

Sizes below are **bytes**, not installed package size. Raw size is minified emitted content; gzip uses level 9 and Brotli quality 11. Multi-asset totals sum each independently compressed file, matching separate HTTP responses. Initial assets follow the manifest's static import/CSS graph and exclude dynamic chunks. External font responses and public media are outside JS/CSS totals.

The probe uses direct package subpath imports, React 19, a small local skin, and CVA variants following the Registry's shadcn `base-nova` component composition. Its minimal styling makes it a dependency-cost probe, not a finished shadcn design system.

| Variant                   | What is actually imported/rendered                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                  | Supplied feature baseline, no Base UI                                                                                                                                                                |
| Replacement               | Build-only overrides replace real `ViewMenu`, `ToolbarAction` (Button + Tooltip), and the loop Checkbox. Existing implementations are removed from that build; no parallel control gallery is added. |
| Full viewer probe         | Baseline plus Button, Checkbox, Menu (items/radio items/separator), Tooltip and annotation Popover, including portals, positioners, titles and descriptions                                          |
| Deferred viewer           | Button + CVA initially; the full viewer popup probe loads after an explicit interaction using React lazy/Suspense                                                                                    |
| Synthetic editor baseline | Baseline plus the actual `EditorLauncher`/Studio import, compiled in production mode solely for comparison                                                                                           |
| Synthetic editor probe    | Synthetic editor baseline plus the viewer primitives and Dialog, Tabs, Select, Slider, Input, Field, Switch and native textarea                                                                      |

The full-viewer and editor galleries are additive estimates and retain the old controls; they are not estimates of an exact completed migration. The real replacement probe addresses that overcount for the most representative viewer controls, and it independently exceeds the gate. More complete styling/theme isolation would also need to be measured. Editor builds are **synthetic sizing probes**, not assets shipped in decks or a claim about development-server transfer size.

## Absolute production sizes

Initial equals total for every eager variant. The deferred variant is shown separately.

| Variant / loading scope       |  JS raw | JS gzip | JS Brotli | CSS raw | CSS gzip | CSS Brotli |
| ----------------------------- | ------: | ------: | --------: | ------: | -------: | ---------: |
| Baseline / total + initial    | 441,521 | 136,862 |   118,461 |  57,800 |    9,676 |      8,182 |
| Replacement / total + initial | 604,874 | 193,180 |   165,864 |  59,216 |   10,098 |      8,531 |
| Full viewer / total + initial | 618,303 | 195,926 |   168,502 |  59,216 |   10,098 |      8,531 |
| Deferred viewer / total       | 619,220 | 197,108 |   170,945 |  59,216 |   10,098 |      8,531 |
| Deferred viewer / initial     | 454,514 | 142,045 |   122,700 |  59,216 |   10,098 |      8,531 |
| Synthetic editor baseline     | 489,317 | 150,388 |   129,425 |  72,337 |   12,964 |     11,060 |
| Synthetic editor probe        | 744,717 | 235,144 |   200,440 |  73,753 |   13,245 |     11,347 |

## Absolute and percentage deltas

Each cell is **additional bytes (percentage)**. Viewer rows compare to the viewer baseline; editor rows compare to the synthetic editor baseline.

| Variant / scope                |       JS raw delta |     JS gzip delta |   JS Brotli delta |   CSS raw delta | CSS gzip delta | CSS Brotli delta |
| ------------------------------ | -----------------: | ----------------: | ----------------: | --------------: | -------------: | ---------------: |
| Replacement / total            | +163,353 (+37.00%) | +56,318 (+41.15%) | +47,403 (+40.02%) | +1,416 (+2.45%) |  +422 (+4.36%) |    +349 (+4.27%) |
| Full viewer / total            | +176,782 (+40.04%) | +59,064 (+43.16%) | +50,041 (+42.24%) | +1,416 (+2.45%) |  +422 (+4.36%) |    +349 (+4.27%) |
| Deferred viewer / total        | +177,699 (+40.25%) | +60,246 (+44.02%) | +52,484 (+44.30%) | +1,416 (+2.45%) |  +422 (+4.36%) |    +349 (+4.27%) |
| Deferred viewer / initial      |   +12,993 (+2.94%) |   +5,183 (+3.79%) |   +4,239 (+3.58%) | +1,416 (+2.45%) |  +422 (+4.36%) |    +349 (+4.27%) |
| Synthetic editor probe / total | +255,400 (+52.20%) | +84,756 (+56.36%) | +71,015 (+54.87%) | +1,416 (+1.96%) |  +281 (+2.17%) |    +287 (+2.59%) |

## Splitting and editor exclusion

The deferred experiment transfers the popup chunk only after the explicit controls action. This reduces initial JS growth to about 3.8% gzip, at the cost of loading the remaining code before those controls become usable. It does not eliminate shipped code: total compressed JS still grows about 44%. Direct subpath imports and production tree shaking are already used in all probes.

The production module graphs for baseline, replacement, eager viewer and deferred viewer all contain **zero `src/editor` modules**. The synthetic editor variants contain the editor's three TS modules by deliberate test-only import. Base UI/CVA are pinned development dependencies at the repository root, not runtime dependencies of the published CLI. No probe is imported by the SDK or application; no consumer shadcn setup or public API has changed.

## Theme boundary and rollout requirements

No application theme boundary has been shipped in this experiment. The small `ui-prototype/theme.css` skin scopes its own declarations and sets explicit fonts/colors on popup roots. It does **not** prove protection against arbitrary authored global CSS. Broad selector isolation, inherited/reset behavior, portal containers, separate viewer/editor React roots, and preserving slide rendering/exports remain mandatory work for a subsequent authorized migration. A scoped token name alone would not establish that separation.

Before rollout, a complete implementation must also centralize application components and compact orange action variants; migrate all controls without exposing editing in production; validate contrasting slide themes and broad selectors with popups open; and cover fullscreen portals, mobile layouts and PDF output. Those checks are not claimed by the current cost probes.

## Validation

- All 29 existing unit tests passed, including the isolated HTTP test (localhost permission required).
- Root TypeScript, CLI TypeScript and strict TypeScript on all prototype TSX files passed.
- Lint passed with two pre-existing `prefer-tag-over-role` warnings in annotation components.
- CLI package build and normal production deck build passed. Final ordinary production JS/CSS match the preserved baseline byte for byte.
- Existing loop browser suite passed in installed Chrome: three loop cycles, final state dwell, shared inspector, guarded unsaved panel switching, timing draft preservation, Studio save, production playback, pause, hidden tab, Escape and single-slide restart; no browser errors.
- Existing editor browser suite completed all assertions: CSS/HMR draft retention, saves/conflicts, rich text, source edits, native reveals/navigation, linked components, production and exposed-server exclusion. Its process retained an open handle after the success messages and was explicitly terminated; a clean teardown is not claimed.
- The editor browser fixture needed a core sibling symlink after the supplied feature patch added the shared ToolbarAction import. The retained test fix supplies that dependency and accepts `PLAYWRIGHT_CHANNEL=chrome`; application code is unchanged.
- Prototype-specific Chrome checks and network evidence are recorded in `browser.json` after a successful run. They cover the cost probes, not completion of the broad migration.

## Reproduce

Run from the repository root:

```sh
bun install --frozen-lockfile
node packages/cli/test/ui-bundle.mjs
node packages/cli/test/ui-prototype.browser.mjs
bun run test
bunx tsc --noEmit
bunx tsc --noEmit -p packages/cli/tsconfig.json
bun run lint
bun run --cwd packages/cli build
bun run build
node packages/cli/test/loop-browser.mjs
PLAYWRIGHT_CHANNEL=chrome node packages/cli/test/editor.browser.mjs
```

Builds and a probe screenshot are written under `/tmp/promptslide-ui-bundles` by default. Set `UI_BUNDLE_OUT` to override it. The production-probe browser script temporarily binds port **5193**, separate from the originating Studio on 5181, and closes its server/browser afterward. The experiment does not run a persistent Studio.

The retained source is under `packages/cli/test/ui-prototype/`; the build harness is `packages/cli/test/ui-bundle.mjs`. The replacement adapter is intentionally test-only, including its checkbox event compatibility shim. None of these files should be promoted into the application as a completed component library.

[Base UI quick start](https://base-ui.com/react/overview/quick-start) and the local Registry's `src/components/ui` definitions supplied the component/portal composition reference. No package was published, no deployment or remote branch was changed, and no migration was applied to the Registry.
