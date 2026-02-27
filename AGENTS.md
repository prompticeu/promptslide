# PowerVibe — Monorepo

This is the PowerVibe monorepo containing the framework package, the scaffolder CLI, and the demo example.

## Repository Structure

```
powervibe/
├── packages/
│   ├── powervibe/              # Framework + CLI npm package
│   │   ├── src/
│   │   │   ├── index.ts        # Public API: SlideLayout, Animated, Morph, etc.
│   │   │   ├── config.ts       # defineConfig() + DeckConfig type
│   │   │   ├── framework/      # Core framework (animations, layout, nav)
│   │   │   ├── components/     # SlideDeck controller + inline icons
│   │   │   ├── lib/utils.ts    # cn() utility
│   │   │   ├── css/globals.css # Base theme (Tailwind + CSS variables)
│   │   │   ├── vite/           # Virtual entry Vite plugin
│   │   │   └── cli/            # powervibe dev | build commands
│   │   ├── bin/cli.mjs         # CLI shim
│   │   └── tsup.config.ts      # Build config
│   │
│   └── create-slides/          # Scaffolder CLI (npx create-slides)
│       ├── src/index.mjs       # Scaffolder logic
│       └── templates/default/  # Lightweight template (~10 files)
│
└── example/                    # Dev playground (demo slide deck)
    ├── deck.config.ts          # Slide list + branding config
    ├── theme.css               # Color customization
    └── src/slides/             # 7 demo slides
```

## Development

```sh
npm install                        # Install all workspaces
npm run build -w packages/powervibe  # Build framework
cd example && npx powervibe dev    # Run demo slides
```

## How It Works

Users install `powervibe` as a dependency. Their project has:
- `deck.config.ts` — slides + branding via `defineConfig()`
- `theme.css` — OKLCH color variables
- `src/slides/` — slide components that `import { SlideLayout } from "powervibe"`

Running `powervibe dev` starts a Vite dev server with a virtual entry module that stitches the user's config with the framework rendering pipeline.

## Packages

### `powervibe` (framework)
- All slide components import from `"powervibe"`
- Exports: `SlideLayout`, `Animated`, `AnimatedGroup`, `Morph`, `MorphGroup`, `MorphItem`, `MorphText`, `SlideDeck`, `SlideBrandingProvider`, `defineConfig`, `cn`, animation configs, types
- CLI: `powervibe dev` (dev server), `powervibe build` (production build)

### `create-slides` (scaffolder)
- `npx create-slides my-deck` creates a lightweight project (~10 files)
- Template uses `import from "powervibe"` pattern
- Framework updates via `npm update powervibe`
