# promptslide

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

> "Create me a 10-slide deck about AgenticRAG"

## CLI Commands

All commands are run via `npx promptslide <command>` (or `bunx promptslide <command>`).

| Command   | Description                              |
| --------- | ---------------------------------------- |
| `create`  | Scaffold a new slide deck project        |
| `studio`  | Start the dev server with hot reload     |
| `build`   | Build the deck for production            |
| `preview` | Preview the production build             |
| `add`     | Add a slide to the current deck          |
| `remove`  | Remove a slide from the current deck     |
| `list`    | List all slides in the current deck      |
| `publish` | Publish the deck to PromptSlide registry |
| `search`  | Search published decks                   |
| `pull`    | Pull a published deck                    |

## How It Works

1. **You describe** what you want in natural language
2. **Your coding agent** uses the [promptslide Skill](https://github.com/prompticeu/promptslide/tree/main/skills/promptslide) to understand the framework
3. **Agent creates** `.tsx` slide files in `src/slides/`
4. **Vite hot-reloads** -- slides appear instantly in your browser
5. **Present** in fullscreen or export to PDF

> Install the Skill: `claude skill add --url https://github.com/prompticeu/promptslide/tree/main/skills/promptslide`

## Links

- [GitHub](https://github.com/prompticeu/promptslide)
- [create-slides](https://www.npmjs.com/package/create-slides) -- scaffolding shortcut

## License

MIT
