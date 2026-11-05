# promptslide

Vibe-code beautiful slide decks using your favorite coding agent.

PromptSlide is a local-first slide framework built with React, Tailwind CSS, and Framer Motion. Open your coding agent (Claude Code, Cursor, Windsurf, etc.), describe the slides you want in natural language, and watch them appear in real-time via Vite's hot module replacement.

## Quick Start

```bash
npm create slides my-deck
cd my-deck
npm install
npm run dev
```

Then open your coding agent and say:

> "Create me a 10-slide deck about AgenticRAG"

## CLI Commands

All commands are run via `npx promptslide <command>`.

| Command    | Description                                           |
| ---------- | ----------------------------------------------------- |
| `create`   | Scaffold a new slide deck project                     |
| `studio`   | Start the dev server with hot reload                  |
| `build`    | Build the deck for production                         |
| `preview`  | Preview the production build                          |
| `add`      | Add a slide to the current deck                       |
| `remove`   | Remove a slide from the current deck                  |
| `list`     | List all slides in the current deck                   |
| `publish`  | Publish the deck to PromptSlide registry              |
| `search`   | Search published decks                                |
| `pull`     | Pull a published deck                                 |
| `to-image` | Export a slide as a PNG image                         |
| `to-pdf`   | Export all slides as a PDF                            |
| `to-pptx`  | Export editable PowerPoint and a compatibility report |

Use optional, unique slide IDs in `src/deck-config.ts` for stable URL links and annotations. Existing numbered slide links and decks without IDs continue to work.

## PowerPoint export

Run `npx promptslide to-pptx -o slides.pptx` or choose **Download → PowerPoint (.pptx)** in local Studio. Conversion runs locally and preserves editable text, native shapes, supported gradients and SVG paths, simple tables, and explicitly supplied chart data/workbooks. Complex effects use localized PNG graphics with source-specific compatibility issues in `slides.pptx.report.json`. Studio supports progress, cancellation and report downloads; static decks hide this local-server action.

For static or embedded viewers, use `<SlideDeck slides={slides} pptxExport="browser" />`. The SDK loads the same converter on demand and generates the file on the user's device, with the existing progress, cancellation and compatibility report UI. No export server or hosted compute is needed. Web fonts and images must be readable by the browser; cross-origin assets require CORS. JavaScript cannot read installed system-font files, so declare accessible `@font-face` URLs when fonts must be embedded. Advanced hosts can import `exportBrowserPptx` from `promptslide/browser` and supply their own manifest and prepared DOM renderer. Browser builds require ES2022 and WebAssembly.

Hosted applications can supply `SlideDeck` with an optional `pptxExportRequest: PptxExportRequest` callback to reuse this download menu and export dialog. The callback receives a relative export path and `RequestInit`, and returns a `Response`; without it, Studio keeps using its local export server. The host must authenticate and authorize every request, including status, cancellation and downloads. The protocol is `GET ""` for `{ supported, token }`, `POST "/pptx"` for `{ jobId }`, `GET "/<jobId>"` for status/progress, `DELETE "/<jobId>"` for cancellation, and `GET "/<jobId>/file"` or `"/<jobId>/report"` for downloads. Status can include `pollAfterMs` (clamped to 500–5000 ms). Keep the callback identity stable and honor abort signals. When hosting untrusted slide code in an iframe, keep credentials in the parent application and forward only these export operations through a validated message channel.

Use `--mode=strict` to return a report without a new PPTX if any graphic fallback or warning is present. `--profile=extended` additionally permits sampled transparent-gradient fills. `--builds=final|slides|native` selects the final state, one slide per reveal state, or native reveal animations. Morph requires final/per-state export. `--font-policy=embed-when-permitted|require-installed` chooses font embedding or an explicit installed-font workflow. Other options: `--report=<path>`, `--timeout=1..600`, `--port=<Studio port>`. Run `to-pptx --help` for syntax.

Chromium is installed on first use when absent. `PROMPTSLIDE_CHROMIUM_PATH` selects an existing executable. Assets/fonts must be available to the browser. Permitted font bytes and variable instances are embedded with their original shaping tables; restricted/unavailable faces produce portability warnings. Static and instanced variable controls load successfully from embedded fonts in LibreOffice 26.2; target Office verification remains necessary. Optional `theme.pptx.fonts` accepts `{ family, path, weight?, style? }` entries pointing to project-local font files. `registerPptxExportAdapter` supports custom native components; `data-pptx-chart` supplies semantic chart data.

Near 1:1 is a target. Current LibreOffice render benchmarks still expose text baseline/spacing differences; desktop Microsoft PowerPoint qualification remains pending. Native object counts describe editability, not certified visual fidelity. Reports explicitly state this qualification status. Full usage, support boundaries and reproducible evidence are documented in the repository's `docs/pptx-export.md` and `benchmarks/pptx/README.md`.

## Auto-loop presentations

Open **Slide settings** in the toolbar, or choose **Present** → **Configure loop…**.
The shared right inspector has **Slide**, **Elements** (local Studio only), and **Comments**
tabs. Use the existing thumbnail rail to select a slide; its settings follow the selection.
Each slide has an initial view plus its numbered click steps. Select a timing row to preview
that exact state on the main canvas, then edit its duration in seconds. The normal navigation
arrows update the highlighted row too. Unconfigured states use the deck default (5 seconds).

**Include in loop** excludes a slide from autoplay while keeping it available for manual
presentations. Excluded slides show **Skip in loop** on their thumbnails. **Loop defaults**
contains the default duration and estimated total time. Edits remain buffered when switching
slides, tabs, or closing the inspector. **Revert** restores the last saved loop settings.

**Save settings** in local Studio writes `loop-config.json` in the project folder.
The CLI embeds it in production builds and preserves it through publish, clone, create,
and pull. Static presentations save changes in that browser; use **Download settings**
and put the file in the project folder to include them in later builds or publications.
Use stable slide IDs so timings survive reordering. Adding steps uses the default duration;
changing a configured slide's step count flags its timings for review.

```json
{
  "version": 1,
  "defaultDuration": 5,
  "slides": {
    "intro": { "steps": 0, "dwell": [6] },
    "agents": { "steps": 5, "dwell": [3, 2, 2, 2, 3, 12] },
    "notification": { "excluded": true }
  }
}
```

`dwell[0]` is the initial state. Later entries correspond to click steps; missing or
`null` entries inherit the default. Durations are between 0.1 and 3600 seconds.
Timing begins after an incoming slide transition; each state duration includes its
reveal animation. The estimated total excludes slide transitions. Videos and custom
animations need enough explicit time; their completion is not detected automatically.

Choose **Auto-loop** to start in full screen from the first included slide, step zero.
**Space** pauses or resumes progression, **Left/Right** navigate within the loop and
restart the state's timer, and **Escape** stops and exits. Timers pause in hidden tabs
without catching up afterward. Pausing progression does not pause custom animations or
videos. Slide components remount each cycle so mount-driven animations replay.

For unattended use, run `npm run build && npm run preview` and open
`http://localhost:4173/?loop`. Click once to start. Full screen requires a real user
interaction; a rejected request shows a retryable error. Keep the computer awake and
self-host fonts, images, video, and other assets needed offline.

Custom SDK hosts can pass `loopConfig` and `onLoopConfigChange` to `SlideDeck` to provide
settings and their own persistence adapter. CLI Studio's file save endpoint accepts
validated, same-origin requests on loopback interfaces only.

```tsx
import { SlideDeck, type LoopConfig } from "promptslide"

const loopConfig: LoopConfig = {
  version: 1,
  defaultDuration: 5,
  slides: {
    intro: { dwell: [6] },
    agents: { steps: 2, dwell: [3, 2, 12] },
    notification: { excluded: true }
  }
}

// `slides` is your existing SlideConfig[] in deck order.
<SlideDeck slides={slides} loopConfig={loopConfig} />
```

The prop overrides CLI/provider defaults; saved browser settings may override the same
base configuration locally. CLI publishing reads `loop-config.json`, so keep shared
timings there rather than only in a React prop. Included slides follow deck order;
there is no separate playlist order.

## How It Works

1. **You describe** what you want in natural language
2. **Your coding agent** uses the [promptslide Skill](https://github.com/prompticeu/promptslide/tree/main/skills/promptslide) to understand the framework
3. **Agent creates** `.tsx` slide files in `src/slides/`
4. **Vite hot-reloads** -- slides appear instantly in your browser
5. **Present** in fullscreen or export to PDF

> The Skill is installed automatically when you run `promptslide create`. To install it manually: `npx skills add prompticeu/promptslide`

## Links

- [GitHub](https://github.com/prompticeu/promptslide)
- [create-slides](https://www.npmjs.com/package/create-slides) -- scaffolding shortcut

## License

MIT

### PDF fidelity

`promptslide to-pdf -o slides.pdf` and Studio's Download → PDF use Chromium at the 1280×720 presentation size with screen styles and final reveal states. Text remains selectable; Chromium handles PDF font subsets and vector drawing. Slides print individually and are combined as native PDF pages, avoiding Chromium pagination clipping defects. External links survive assembly; structure tagging is not retained in merged multipage files. Font/stylesheet retries, explicit font loading, visible image decoding, offscreen lazy-image loading and deterministic animation settling run before capture. Missing visible assets and slide crashes fail export instead of producing an incomplete PDF. Custom CSS finite animations settle at their end; infinite animations pause at time zero. Arbitrary asynchronous components still need to render stable content before capture. Static deployments retain browser printing, whose output depends on the browser's print settings. `PROMPTSLIDE_CHROMIUM_PATH` selects a custom installed Chromium for both PDF and PowerPoint.

PDF gradient-text paint uses localized 2× graphics where needed to avoid viewer-specific clipping; underlying ordinary text stays searchable/selectable. Other text, shapes and supported gradient fills retain native PDF output. Compositions with transformed or translucent ancestors are outside this workaround's admitted subset.
