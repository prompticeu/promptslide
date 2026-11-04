# Export editable PowerPoint

In local Studio, choose **Download → PowerPoint (.pptx)** in the viewer toolbar, then **Export .pptx**. Conversion quality is automatic: native objects are preferred, with localized graphics where needed to preserve appearance. Each slide exports with all content revealed by default. For decks with click-to-reveal steps, a collapsed **Animation options** section offers separate slides per reveal or native PowerPoint reveal animations; decks without reveals show no animation controls. It shows slide conversion progress, supports cancellation, and provides a JSON compatibility report. The result groups repeated compatibility warnings by type and keeps informational conversion details separate. Missing-font warnings expand automatically. Unsaved editor drafts require saving or explicitly exporting the last saved version. The action is hidden in static deployments.

The same deterministic converter runs from the deck directory:

```sh
npx promptslide to-pptx -o slides.pptx
npx promptslide to-pptx -o slides.pptx --mode=strict
npx promptslide to-pptx -o builds.pptx --builds=slides
```

The converter runs locally with Chromium. Its first use installs Playwright Chromium if needed; browser system libraries must be available. `PROMPTSLIDE_CHROMIUM_PATH` can select an existing Chromium executable. No LLM, coding agent or conversion service is involved. Browser fonts and assets referenced by the deck can still require network access; use local assets for reproducible offline exports.

## What stays editable

| Source                                                                   | PowerPoint representation                                                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS boxes, solid fills, borders, rounded corners, circles                | Native preset/custom shapes, including measured positions and sizes                                                                           |
| Supported SVG paths and Lucide icons                                     | Native editable freeforms, custom dashes and ordinary SVG text; unsupported effects use localized graphics                             |
| Ordinary sRGB linear gradients                                           | Native gradient fills with directions and stops, including supported background-clipped text                                                                                               |
| Centered `circle farthest-corner` radial gradients                       | Native path shading; qualified single-hue elliptical glows use native gradient groups; other cases use reported PNG paint fallbacks                                                     |
| Opaque categorical conic fills on centered circles                       | A bounded group of native editable sectors; continuous, transparent, off-center or transformed conic fills use reported PNG fallbacks         |
| Transparent gradients                                                    | Sampled native stops, explicitly reported as an approximation                                                                                 |
| Text                                                                     | Editable rich runs in independently positioned, browser-measured lines; native bullet/number markers                                          |
| Images                                                                   | Native pictures with crop/position/rotation; safe SVG images include SVG and a PNG compatibility image                                        |
| Simple HTML tables                                                       | Native tables, including spans, plain text, fills, font styles, padding and borders; nested/styled composite content uses a reported fallback |
| Explicit chart data                                                      | Native charts with an embedded editable workbook                                                                                              |
| Complex clips, group opacity, blending, shadows, pseudo-elements, canvas | Localized PNG fallbacks preserving the painted scope; reported as graphics, never counted as native shapes                                    |

Web layout, including grid and flex, is measured at 1280×720. Ordinary CSS translations and leaf rotation/scale are supported. Positive uniform group scaling preserves native children and their measured font sizes. Other complex transformed groups use graphics. A custom SVG illustration is native only when its supported paths can be translated; importing an SVG image does not turn it into editable geometry.

Text and SVG groups use bounds around their content for selection and resizing in PowerPoint.

Native charts require semantic data, for example:

```tsx
<div
  style={{ width: 600, height: 400 }}
  data-pptx-chart={JSON.stringify({
    type: "column",
    series: [{ name: "Revenue", labels: ["2025", "2026"], values: [4, 7] }],
    colors: ["2563EB"],
    showLegend: false
  })}
>
  {/* Render the equivalent chart in the browser here. */}
</div>
```

Optional chart formatting includes `fontFamily`, `fontSize` (CSS pixels), `textColor`, `background`, `legendPosition`, `valueAxis: {min,max,majorUnit}`, fractional `plotArea: {x,y,width,height}`, `gridColor`, `gapSizePercent` and `overlapPercent`. All series must share category labels; scatter labels must be finite numeric X values. Pie/doughnut currently accept one series. Zero values survive in both chart caches and the editable workbook.

Types: `bar`, `column`, `line`, `area`, `pie`, `doughnut`, `scatter`. Office determines its chart layout; matching arbitrary SVG/canvas charts requires a deliberate semantic adapter and target-renderer verification. Generic SVG bars are exported as geometry rather than inferred data.

For custom components, register `registerPptxExportAdapter` in a module imported by the deck. Its `match(element)`, optional asynchronous `ready(element, signal)`, and `toScene(element, context)` produce explicitly positioned native shape/text/picture/table/chart nodes. An adapter consumes its matched subtree. IDs must be unique within its result, boxes use design pixels, and colors use `{hex:"2563EB", alpha:1}`. Use `getPptxExportAdapters` only for introspection; the export view loads registered adapters automatically. See the native payload schemas in the [implementation specification](specs/pptx-export.md).

## Fonts and compatibility

The exporter discovers actual browser faces, captures loaded font assets, resolves local installed faces, and embeds fonts when their embedding permissions allow editing. Original static font tables are preserved. Variable fonts are instanced at the requested axes with all glyphs and shaping tables retained. The EOT wrapper is independently decoded with libeot and checked against the original sfnt bytes. Uninstalled static and variable control faces load from the exported presentation in LibreOffice 26.2; variable instancing is reported as informational. Controlled text ink bounds differ by at most two pixels at 1280×720. This is evidence for those controls, not universal font qualification. Font embedding does not guarantee identical line placement across Office versions.

Supply explicit project-local font files in `src/theme.ts` when necessary:

```ts
export const theme = {
  // Existing theme settings...
  pptx: {
    fonts: [
      { family: "Acme Sans", path: "public/fonts/acme-sans.ttf", weight: 400, style: "normal" }
    ]
  }
}
```

Restricted or unavailable faces remain editable with an installed-font dependency and a warning. `--font-policy=require-installed` explicitly chooses an installed-font workflow. Recipients need matching fonts. Local font paths must resolve inside the project. Source/asset symlinks are followed with cycle and nesting checks.

Font coverage is checked against the text being exported. Distinct source subsets and static weights receive distinct embedded identities. Mixed browser fallback faces are retained per text cluster where their files are available; an unresolved cluster uses a reported localized graphic. Font bytes are captured before downloaded faces are released to Chromium, avoiding a readiness race between layout and embedding.

Inline margins retain separate measured positions, table row heights are measured independently of spanning cells, and intrinsic image sizing includes CSS transforms. Translucent composites, charts and tables use localized graphics when native objects cannot preserve their combined opacity. Cancellation waits for creation and server cleanup before allowing another attempt.

**Near 1:1 is a target, not a certification claim.** The checked-in suite includes actual LibreOffice-rendered PPTX comparisons. Text baselines/spacing still differ in those renders. Desktop Microsoft PowerPoint rendering and edit/save/reopen qualification have not run in this environment. `nativeExactObjects` in the report describes the chosen native representation; it is not a pixel-fidelity score. Each report explicitly marks visual fidelity as unevaluated and Microsoft PowerPoint as unqualified. Use the [benchmark and qualification harness](../benchmarks/pptx/README.md) before making a fidelity commitment to customers.

## Options and reports

| Option          | Values/default                                        |
| --------------- | ----------------------------------------------------- |
| `--mode`        | `balanced` (default), `strict`                        |
| `--profile`     | `core-native` (default), `extended`                   |
| `--builds`      | `final` (default), `slides`, `native`                 |
| `--font-policy` | `embed-when-permitted` (default), `require-installed` |
| `--report`      | Defaults to `<output>.report.json`                    |
| `--timeout`     | 1–600 seconds; default 600                            |
| `--port`        | Reuse a local Studio serving this project             |

Balanced mode downloads the deck and reports compatibility issues. Strict core mode returns a report without a new PPTX when a fallback or warning exists. Extended strict mode explicitly permits the sampled transparent-gradient approximation; it still rejects graphics and other warnings. Neither policy performs target-renderer visual certification. Native animation mode supports reveal effects; Morph requires final-state or per-state export.

Reports contain source IDs, slide states, output object IDs/representations, localized fallback bounds/reasons, editable character and native object counts, font hashes, timings, source revision and the rendering browser. Studio results expire after 15 minutes, with one active export and at most four retained jobs. Its job API accepts loopback requests, or same-origin Tailscale peers when Studio is explicitly bound to its Tailscale IP. Public/wildcard bindings retain loopback-only export access. Requests remain protected with an in-memory session token. Cancellation removes result access and closes the worker browser.

Limits: 100 source slides, 500 expanded states, 100,000 scene nodes, 10,000 segments per path, 10,000 points per chart, 10,000 cells per table, 256 gradient stops, 50 MB per asset, 50 million decoded image pixels and 250 MB output. Exports reject changing source snapshots and malformed packages. Snapshot checks include resolved paths, file size, nanosecond modification/change times and file identity, avoiding full reads of large media files. Timeouts report `EXPORT_TIMEOUT` as a failure, separately from user cancellation. CLI exit codes: `0` completed, `1` runtime/validation failure, `2` strict rejection, `130` cancellation. Existing output files are replaced only after a successful export.

## Validation and limitations

The focused [export regression suite](../benchmarks/pptx/README.md) covers font coverage, native geometry, clipping, opacity, cancellation, job access, and PDF rendering. Generated decks and research archives stay local.

Near-1:1 is a target. Desktop PowerPoint edit/save/reopen and macOS PDF viewer verification remain pending. Native elliptical glows use a reported strip approximation; LibreOffice can show seams. Unsupported paint remains a localized graphic. PDF gradient text can use a localized 2× graphic with selectable text underneath, and merged multipage PDFs do not retain structure tags.

Font embedding targets PowerPoint. Embedded faces use distinct internal names so font subsets and weight variants cannot overwrite each other. Apps that ignore embedded fonts may substitute another face even when the original family is installed. Use `--font-policy=require-installed` when preserving installed family names is more important than embedding.
