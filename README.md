# PromptSlide

**Vibe Coding Slides for your Coding Agents.**

PromptSlide is a local-first slide framework built with React, Tailwind CSS, and Framer Motion. Open your coding agent (Claude Code, Cursor, Windsurf, etc.), describe the slides you want in natural language, and watch them appear in real-time via Vite's hot module replacement.

<table>
  <tr>
    <td><img src="docs/showcase/consulting-ai-cover.png" alt="AI Consulting cover slide — dark elegant theme" width="360" /></td>
    <td><img src="docs/showcase/gen-z-cover.png" alt="Gen-Z cover slide — bold orange theme" width="360" /></td>
    <td><img src="docs/showcase/agentic-rag-cover.png" alt="Agentic RAG cover slide — dark tech theme" width="360" /></td>
  </tr>
  <tr>
    <td><img src="docs/showcase/consulting-ai-split.png" alt="Split design with pricing stats" width="360" /></td>
    <td><img src="docs/showcase/gen-z-cards.png" alt="Card layout with AI agent examples" width="360" /></td>
    <td><img src="docs/showcase/promptslide-bento.png" alt="Bento grid capabilities overview" width="360" /></td>
  </tr>
</table>

## Quick Start

```bash
promptslide create my-deck
cd my-deck
bun install
bun run dev
```

Then open your coding agent and say:

> "Create me a 10-slide deck about AgenticRAG"

## MCP Server

Connect the PromptSlide MCP server to give your AI tools for creating, editing, and previewing slides — including visual screenshots.

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "promptslide": {
      "command": "npx",
      "args": ["promptslide", "studio", "--mcp"]
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json` (Settings > Developer > Edit Config):

```json
{
  "mcpServers": {
    "promptslide": {
      "command": "npx",
      "args": ["promptslide", "studio", "--mcp"]
    }
  }
}
```

### Desktop App (Tauri)

For the desktop app experience (like [paper.design](https://paper.design)):

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Start the app
cd packages/app
bun install
bun run tauri:dev
```

Then connect Claude Desktop to the running MCP server:

```json
{
  "mcpServers": {
    "promptslide": {
      "command": "npx",
      "args": ["mcp-remote", "http://127.0.0.1:29170/mcp"]
    }
  }
}
```

### Cursor / Other Agents

Install the PromptSlide skill for agents that don't support MCP:

```bash
npx skills add prompticeu/promptslide
```

## How It Works

1. **Connect the MCP server** or install the Skill
2. **You describe** what you want in natural language
3. **Your coding agent** creates HTML slide files with Tailwind CSS
4. **Vite hot-reloads** — slides appear instantly in your browser
5. **Present** in fullscreen or export to PDF

No cloud, no API keys. Just a local Vite project + your coding agent.

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
- **List**: Vertical scroll — optimized for PDF export

## Tech Stack

- [React 19](https://react.dev)
- [Vite 6](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Framer Motion 12](https://motion.dev)
- [Lucide Icons](https://lucide.dev)

## License

MIT
