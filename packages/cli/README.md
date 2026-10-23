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

| Command    | Description                              |
| ---------- | ---------------------------------------- |
| `create`   | Scaffold a new slide deck project        |
| `studio`   | Start the dev server with hot reload     |
| `build`    | Build the deck for production            |
| `preview`  | Preview the production build             |
| `add`      | Add a slide to the current deck          |
| `remove`   | Remove a slide from the current deck     |
| `list`     | List all slides in the current deck      |
| `publish`  | Publish the deck to PromptSlide registry |
| `search`   | Search published decks                   |
| `pull`     | Pull a published deck                    |
| `to-image` | Export a slide as a PNG image            |
| `to-pdf`   | Export all slides as a PDF               |

Use optional, unique slide IDs in `src/deck-config.ts` for stable URL links and annotations. Existing numbered slide links and decks without IDs continue to work.

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
