# Auto-loop Presentations

Use the built-in autoplay for convention displays and unattended presentations. It advances the same click steps as manual navigation, skips excluded slides, and wraps to the first included slide. Included slides follow `slides` order in `src/deck-config.ts`; there is no separate playlist order.

## CLI Projects: Shared Configuration

Create `loop-config.json` in the project root. Studio's Slide inspector edits this same file when the user clicks **Save settings**. The CLI loads it automatically in Studio, embeds it in production builds, and includes it in registry publishing. Clone, create-from-deck, and pull restore it.

```json
{
  "version": 1,
  "defaultDuration": 5,
  "slides": {
    "intro": { "steps": 0, "dwell": [6] },
    "agents": { "steps": 2, "dwell": [3, 2, 12] },
    "notification": { "excluded": true }
  }
}
```

- Keys match stable slide IDs. Keep IDs unchanged when reordering slides.
- Durations are seconds, between 0.1 and 3600. Unspecified slides are included and use the default duration.
- `dwell[0]` is the initial view, followed by one entry per click step. Missing or `null` entries inherit `defaultDuration`.
- Optional `steps` records the slide's click-step count when configured so Studio can flag outdated timings. The actual step count remains in `src/deck-config.ts` and must match the highest animation step.
- Timing begins after the incoming slide transition; each duration includes the state's reveal animation. Allow time for videos and self-running animations: autoplay does not detect when they finish.

## SDK Hosts: Typed Configuration

Pass the same data directly to `SlideDeck`:

```tsx
import { SlideDeck, type LoopConfig } from "promptslide"
import { slides } from "./deck-config"

const loopConfig: LoopConfig = {
  version: 1,
  defaultDuration: 5,
  slides: {
    intro: { dwell: [6] },
    agents: { steps: 2, dwell: [3, 2, 12] },
    notification: { excluded: true }
  }
}

export default function App() {
  return <SlideDeck slides={slides} loopConfig={loopConfig} />
}
```

The `loopConfig` prop overrides the CLI/provider default. A custom host can supply `onLoopConfigChange(config)` to persist changes saved through the inspector, or use the exported `LoopConfigProvider` for shared defaults. Saved browser settings can override the same base configuration locally; changing the base invalidates those overrides.

CLI publishing reads `loop-config.json`, not arbitrary React props or a TypeScript config module. For a CLI deck that must publish its timings, keep them in the JSON file and let the CLI provide them automatically. In a static or registry preview, saving without a custom persistence callback only affects that browser; download the JSON into the project before rebuilding or republishing shared settings.

## Playback and Verification

Choose **Present → Auto-loop**, or open a built deck at `/?loop` and click **Start loop**. Full screen requires a real user click or key press. Playback starts at the first included slide's initial view. **Space** pauses/resumes progression; **Left/Right** navigate; **Escape** stops and exits full screen. Hidden tabs pause timers. Pausing progression does not pause custom animations or videos. Slide components remount each cycle so mount-driven animations replay.

Verify the initial view, every reveal, exclusions, and wraparound over several cycles. Test on the actual display using `npm run build && npm run preview`; keep the device awake and bundle any assets needed offline.
