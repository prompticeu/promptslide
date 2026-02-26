# {{PROJECT_NAME}}

A slide deck built with [PowerVibe](https://github.com/prompticeu/powervibe) — React + Tailwind + Framer Motion.

## Getting Started

```bash
npm install
npm run dev
```

Then open your coding agent (Claude Code, Cursor, Windsurf, etc.) and say:

> "Create me a 10-slide pitch deck for [your topic]"

The agent reads `AGENTS.md`, generates slide files in `src/slides/`, and Vite hot-reloads them instantly.

## Customization

- **Brand color**: Edit `--primary` in `src/globals.css`
- **Company name**: Edit branding in `src/App.tsx`
- **Logo**: Replace `public/logo.svg`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `Space` | Next step or slide |
| `←` | Previous step or slide |
| `F` | Toggle fullscreen |
| `G` | Toggle grid view |

## Learn More

See `AGENTS.md` for full framework documentation.
