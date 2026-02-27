# PromptSlide

Vibe-code beautiful slide decks using your favorite coding agent.

PromptSlide is a local-first slide framework built with React, Tailwind CSS, and Framer Motion. Open your coding agent (Claude Code, Cursor, Windsurf, etc.), describe the slides you want in natural language, and watch them appear in real-time via Vite's hot module replacement.

## Quick Start

```bash
bun create slides my-deck
cd my-deck
bun install
bun run dev
```

Then open your coding agent and say:

> "Create me a 10-slide pitch deck for my fintech startup"

The agent reads `AGENTS.md`, generates slide files in `src/slides/`, updates `src/deck-config.ts`, and Vite hot-reloads them instantly.

## How It Works

1. **You describe** what you want in natural language
2. **Your coding agent** reads `AGENTS.md` to understand the framework
3. **Agent creates** `.tsx` slide files in `src/slides/`
4. **Vite hot-reloads** — slides appear instantly in your browser
5. **Present** in fullscreen or export to PDF

No server, no API, no sandbox. Just a local Vite project + your coding agent.

## Customization

### Brand Colors

Edit `src/globals.css` and change `--primary`:

```css
:root {
  --primary: oklch(0.55 0.2 250); /* Blue (default) */
}
```

### Company Branding

Edit `src/theme.ts`:

```ts
import type { ThemeConfig } from "promptslide"

export const theme: ThemeConfig = {
  name: "Your Company",
  logo: { full: "/logo.svg" },
}
```

Replace `public/logo.svg` with your own logo.

### Slide Transitions

In `src/App.tsx`, pass a `transition` prop to `SlideDeck`:

```tsx
<SlideDeck slides={slides} transition="slide-left" directionalTransition />
```

Options: `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `none`

## Keyboard Shortcuts

| Key           | Action                 |
| ------------- | ---------------------- |
| `→` / `Space` | Next step or slide     |
| `←`           | Previous step or slide |
| `F`           | Toggle fullscreen      |
| `G`           | Toggle grid view       |
| `Escape`      | Exit fullscreen        |

## View Modes

- **Presentation**: Single slide with navigation controls
- **Grid**: Thumbnail overview — click to jump
- **List**: Vertical scroll — use browser print for PDF export

## Tech Stack

- [React 19](https://react.dev)
- [Vite 6](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Framer Motion 12](https://motion.dev)
- [Lucide Icons](https://lucide.dev)

## License

MIT
