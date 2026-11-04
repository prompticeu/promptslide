# Export regression tests

This directory contains focused tests for the shipping PPTX/PDF converters. Historical research, generated exports and the downloaded registry deck are kept locally, outside the feature PR.

## Setup

From the repository root:

```sh
bun install --frozen-lockfile
npm ci --prefix benchmarks/pptx
npx playwright install chromium
npm test
```

Set `PPTX_BENCH_CHROMIUM` and `PROMPTSLIDE_CHROMIUM_PATH` when using an existing Chromium executable. Font fixtures use DejaVu Serif from `/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf`. Browser tests start temporary local projects and close them after use.

## Shipping-path checks

Run each script with `node benchmarks/pptx/<script>`:

| Script | Checks |
| --- | --- |
| `contract.mjs` | 16 contracts: final/per-state/native reveals, strict rejection, native charts/tables, clipping, concurrent capture and abort |
| `review-regressions.mjs` | 15 generic fixtures / 17 states: opacity, image sizing, reflection, SVG geometry, inline spacing, rowspans and nested reveals |
| `cancellation-regression.mjs` | Cancel before delayed job creation and during download, then retry without stale downloads |
| `font-reliability.mjs` | Font/stylesheet recovery and explicit permanent failure |
| `native-regions-qualification.mjs` | Nine clip, scale, opacity and masked-dot fixtures |
| `svg-gradient-qualification.mjs` | Three native fill cases and six conservative fallbacks |
| `studio.mjs` | Actual PDF/PPTX download, saved-version guard, report, cancellation and focus restoration |
| `pdf-ui-regression.mjs` | Busy state, visible failures, no silent printing on server failure, static print fallback |
| `pdf-qualification.mjs` | Seven full-page PDF comparisons, fonts/subsets, assets, links, native page assembly and gradient-text occlusion |

`PPTX_STUDIO_URL` optionally targets an existing Studio for `studio.mjs`. Otherwise it creates/reuses a local server.

The PDF qualification requires Poppler (`pdfinfo`, `pdffonts`, `pdftotext`, `pdftoppm`) on PATH. `PDF_BENCH_POPPLER` selects a bin directory; `PDF_BENCH_LIBRARY_PATH` supplies a custom library path. Its declared full-page gates are mean absolute RGB error <1.5/255 and fewer than 1.5% of pixels with a channel difference >16/255. It also checks text extraction after localized gradient-text paint conversion and verifies that admitted masked dot grids use explicit vector circles instead of repeating PDF pattern resources.

Outputs go under ignored `results/`. The suite qualifies the tested fixtures and engines, not every PowerPoint/PDF viewer. Desktop PowerPoint edit/save/reopen and macOS PDF rendering remain manual checks; package validity alone is not a visual fidelity guarantee.
