# Export implementation contract

The converter runs locally and deterministically. Browser-measured presentation state is authoritative. PPTX prefers editable native objects; unsupported effects preserve appearance through localized graphics and an explicit report. PDF uses Chromium printing and native PDF page assembly. There is no LLM conversion step.

## Rendering and scene extraction

- Render at 1280×720 design pixels, with an export animation context and stable slide IDs.
- Final-state export is the default. Per-state export renders each reveal separately; native PowerPoint reveals inherit the highest enclosing build step. Morph requires final/per-state output.
- Retry transient font/stylesheet requests before layout settles. Capture font bytes before fulfilled font requests reach Chromium. Wait for images, fonts and two animation frames; fail unstable or invalid content rather than silently dropping it.
- Measure computed positions, sizes, colors, SVG geometry, text baselines, inline fragments, table rows, transforms and paint order. Preserve explicit inline gaps and inherited clipping.
- Scene objects include identity/source, design-pixel box, opacity, build step, component ownership, and a typed payload. The serializable public types are in [types.ts](../../packages/cli/src/core/export/types.ts).

## PPTX serialization

- Convert design pixels to EMU using 9,525 EMU/px; text sizes convert at 0.75 pt/px.
- Prefer native boxes, rounded geometry, supported SVG freeforms, measured rich-text runs, pictures, simple tables and semantic charts with embedded workbooks.
- Preserve simple rotation/reflection and positive uniform group scales. Complex transforms, partial clipping and unsupported composites use bounded source captures. Apply screenshot alpha once; a subtree capture consumes the native paint it replaces.
- Normalize native gradient stops with bounded premultiplied-color interpolation. Admission and serialization share the 256-stop ceiling. Unsupported gradients fall back before writing.
- Centered circular radial fills use native path shading. Admitted constant-hue elliptical glows use at most 360 horizontal gradient strips with bounded sampling; strict mode rejects their approximation warning. Unsupported origins, colors, transforms and sharp falloffs remain graphics.
- Bounded categorical conic fills use native sectors. Supported SVG paths, simple masked dot grids, and clipped interior components remain native; unsupported paint is captured locally.
- Measure table row heights independently of rowspan cell heights. Native charts require explicit semantic data; do not infer data from arbitrary drawn charts. Translucent chart/table composites use graphics when group alpha cannot be retained.

## Fonts and text

- Discover browser-used faces and captured/configured/system font files. Check embedding permissions and glyph coverage before claiming portability.
- Preserve source shaping tables. Pin variable axes to static instances; assign distinct identities to different subsets, weights and instances.
- Resolve a complete run against its primary family first. If coverage spans subsets/fallback faces, split only at Unicode grapheme boundaries and retain each source face. Unresolved clusters use a localized graphic rather than missing glyphs.
- Preserve measured lines and inline formatting. Ordinary SVG labels stay text; admitted affine SVG lettering uses native outlines. Complex shaping remains explicitly unqualified.
- Support project-local font configuration through `theme.pptx.fonts`; configured paths must stay inside the project.

## Adapter payloads

Register `registerPptxExportAdapter` in a module imported by the deck. Adapters consume their matched subtree and return unique, explicitly positioned native objects. Coordinates are design pixels; colors use `{hex:"2563EB",alpha:1}`.

| Kind | Required payload |
| --- | --- |
| `shape` | `fill` (solid or admitted gradient), optional border/radii/rotation |
| `text` | measured `lines` with positioned runs and complete font descriptors |
| `picture` | image data/URL, intrinsic dimensions, fit/position and optional rotation |
| `table` | rows of cells with text, spans, style and measured boxes/row heights |
| `chart` | supported type and series of names, category labels and numeric values |

Charts support bar/column/line/area/pie/doughnut/scatter. Pie/doughnut use one series; scatter categories must be numeric. The public chart options and adapter interfaces are declared in `core/export/types.ts`; writer validation rejects malformed or oversized payloads.

## Jobs, options and reports

- CLI: `to-pptx -o slides.pptx`; write the compatibility report alongside the file. Studio exposes the same engine through Download → PowerPoint.
- Defaults: balanced mode, core-native profile, final build state, permitted font embedding, 600-second timeout, 2× localized captures. Strict mode rejects fallbacks/warnings; extended strict explicitly allows the sampled transparent-gradient approximation.
- Studio jobs require a same-origin token and loopback access, or a specifically bound tailnet interface and tailnet peer. Wildcard binding does not grant remote export access.
- One PPTX worker, bounded retained results, expiry, cancellation and unsaved-draft guards. Each UI attempt owns its cancellation state; wait for creation/DELETE cleanup before retrying, and suppress stale poll/download callbacks.
- Reports distinguish native exact, native approximate and graphics representations, editable/source text, fallback area, fonts, issues and source provenance. Representation counts are not a pixel-fidelity certification.
- Validate package relationships, IDs, content types, geometry, chart/workbook data and notes/theme ownership. Serialize deterministically and enforce resource bounds in `utils/pptx/options.mjs`.

## PDF path

- Use screen styles, exact 1280×720 pages, zero margins and deterministic final reveal states. Decode visible/lazy image assets; fail font/image/slide errors explicitly.
- Print each slide at the viewport origin, re-settle animations after visibility changes, and merge native PDF pages with pdf-lib. Preserve selectable text, fonts, shapes, gradients and external link annotations without flattening whole slides.
- For admitted gradient text, capture cropped 2× paint and retain low-opacity ordinary text for selection/search. Insert the graphic in the source stacking context so foreground objects still occlude it. Transformed/faded ancestor compositions stay on the native print path.
- Expand admitted masked SVG dot patterns into explicit vector circles, reusing the bounded PPTX pattern conversion. Preserve dot geometry and sample fade opacity with a per-dot variation bound of 1/255; unsupported patterns stay on the native print path.
- Server errors surface in the Download UI. Static deployments retain browser printing. Unchanged capture configuration is not rewritten, avoiding spurious Vite reloads.
- Merged multipage PDFs do not retain accessibility structure tags. PDF viewer text/gradient rendering can differ; macOS verification remains pending.

## Validation boundary

Run the [focused regression suite](../../benchmarks/pptx/README.md) for unit, browser, font-recovery, native-region, SVG and PDF checks. PDF fixtures compare complete rendered pages against browser references, including fragmented gradient text and foreground occlusion. Font/subset and chart/workbook tests inspect the actual generated documents.

Desktop Microsoft PowerPoint edit/save/reopen is not qualified here. LibreOffice may show seams in native elliptical strips. Near-1:1 appearance remains the target, and a valid native package does not establish universal visual fidelity. The exploratory scripts, historical results and generated example decks are retained locally rather than shipped in this feature PR.
