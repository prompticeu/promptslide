# create-slides

Scaffold a new [PromptSlide](https://www.npmjs.com/package/promptslide) slide deck project.

## Usage

```bash
# npm
npm create slides my-deck

# bun
bun create slides my-deck

# npx
npx create-slides my-deck
```

Then start building:

```bash
cd my-deck
bun install
bun run dev
```

Open your coding agent and describe the slides you want -- they appear in real-time via hot reload. The [promptslide Skill](https://github.com/prompticeu/promptslide/tree/main/skills/promptslide) is installed automatically during project creation.

## What It Does

This package is a thin wrapper around `promptslide create`. It exists so that `npm create slides` and `bun create slides` work out of the box.

## Links

- [promptslide](https://www.npmjs.com/package/promptslide) -- full CLI and slide engine
- [GitHub](https://github.com/prompticeu/promptslide)

## License

MIT
