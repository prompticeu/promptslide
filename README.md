# PowerVibe

Vibe-code beautiful slide decks using your favorite coding agent.

PowerVibe is a slide presentation framework built with React, Tailwind CSS, and Framer Motion. Install it as an npm package, describe the slides you want in natural language, and watch them appear in real-time via Vite HMR.

## Quick Start

```bash
npx create-slides my-pitch-deck
cd my-pitch-deck
npm install
npm run dev
```

Then open your coding agent and say:

> "Create me a 10-slide pitch deck for my fintech startup"

The agent reads `AGENTS.md`, generates slide files in `src/slides/`, updates `deck.config.ts`, and Vite hot-reloads them instantly.

## How It Works

1. **You describe** what you want in natural language
2. **Your coding agent** reads `AGENTS.md` to understand the framework
3. **Agent creates** `.tsx` slide files that `import { SlideLayout } from "powervibe"`
4. **Vite hot-reloads** — slides appear instantly in your browser
5. **Present** in fullscreen or export to PDF

## Project Structure

A scaffolded project contains just ~10 files:

```
my-deck/
├── deck.config.ts          # Slides + branding (defineConfig)
├── theme.css               # Color customization (OKLCH)
├── tsconfig.json
├── package.json            # "dev": "powervibe dev"
├── AGENTS.md               # Agent documentation
├── public/logo.svg
└── src/slides/
    ├── slide-title.tsx     # import { SlideLayout } from "powervibe"
    └── slide-example.tsx
```

## Customization

### Brand Colors

Edit `theme.css` and change `--primary`:

```css
:root {
  --primary: oklch(0.55 0.2 250);  /* Blue (default) */
}
```

### Company Branding

Edit `deck.config.ts`:

```ts
export default defineConfig({
  branding: { name: "Your Company", logoUrl: "/logo.svg" },
  slides: [ ... ],
})
```

### Slide Transitions

```ts
export default defineConfig({
  transition: "slide-left",
  directionalTransition: true,
  slides: [ ... ],
})
```

Options: `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `none`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `Space` | Next step or slide |
| `←` | Previous step or slide |
| `F` | Toggle fullscreen |
| `G` | Toggle grid view |
| `Escape` | Exit fullscreen |

## Updating

```bash
npm update powervibe
```

No re-scaffolding needed — your slides stay exactly as they are.

## Tech Stack

- [React 19](https://react.dev)
- [Vite 6](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Framer Motion 12](https://motion.dev)
- [Lucide Icons](https://lucide.dev)

## Development (monorepo)

```bash
npm install
npm run build                        # Build framework
cd example && npx powervibe dev      # Run demo
```

## License

MIT
