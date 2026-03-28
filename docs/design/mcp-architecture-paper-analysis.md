# PromptSlide MCP Architecture — Paper.design Analysis

> Analysis of how [paper.design](https://paper.design) implements MCP and desktop app integration, and how similar patterns could be applied to PromptSlide.

## Table of Contents

- [Paper.design Architecture](#paperdesign-architecture)
- [Paper's MCP Tools](#papers-mcp-tools)
- [File Storage & Collaboration](#file-storage--collaboration)
- [Mapping to PromptSlide](#mapping-to-promptslide)
- [Proposed PromptSlide MCP Architecture](#proposed-promptslide-mcp-architecture)
- [Proposed MCP Tools](#proposed-mcp-tools)
- [Advantages Over Current Skills Approach](#advantages-over-current-skills-approach)
- [Collaboration Strategy](#collaboration-strategy)
- [Sources](#sources)

---

## Paper.design Architecture

### Core Philosophy

Paper's canvas IS code. It uses real HTML/CSS as its native format — no proprietary format, no translation layer. Every artboard is actual DOM elements with real flexbox, CSS properties, and font rendering. Because LLMs are excellent at understanding the DOM, this makes agent interaction natural and high-fidelity.

### Architecture — "Local Bridge Pattern"

```
[Coding Agent (Claude Code / Cursor / Copilot / Codex)]
        |
        | Streamable HTTP (JSON-RPC) @ 127.0.0.1:29979/mcp
        v
[Paper Desktop App — Local MCP Server]
        |
        | HTML/CSS DOM manipulation
        v
[Paper Design Canvas (real HTML/CSS)]
        |
        | Cloud sync
        v
[Paper Cloud Platform (app.paper.design)]
```

### The Desktop App

The desktop app is the **linchpin** of the architecture. It exists specifically because a web app cannot easily host a local MCP server. The desktop app:

- Runs on **macOS, Windows, and Linux**
- **Auto-starts** the MCP server on `localhost:29979` when a file is open
- **Bridges** coding agents (running in terminals/IDEs) to the visual design canvas
- Uses **Streamable HTTP** transport (not stdio), enabling multiple potential clients

Agent setup is a single command:

```bash
claude mcp add paper --transport http http://127.0.0.1:29979/mcp --scope user
```

---

## Paper's MCP Tools

Paper exposes **24 tools** through its MCP server — significantly more than Figma's 3. The key differentiator is **full bidirectional access**: agents can both read and write to the canvas.

### Read Tools (~9)

| Tool | Purpose |
|------|---------|
| `get_basic_info` | File name, page name, node count, artboard list with dimensions |
| `get_selection` | Currently selected nodes (IDs, names, types, size, artboard) |
| `get_node_info` | Node details by ID (size, visibility, lock, parent, children, text content) |
| `get_children` | Direct children of a node (IDs, names, types, child counts) |
| `get_tree_summary` | Compact text summary of subtree hierarchy (optional depth limit) |
| `get_screenshot` | Base64 screenshot of a node (1x or 2x scale) |
| `get_jsx` | JSX output for a node and descendants (Tailwind or inline-styles format) |
| `get_computed_styles` | Computed CSS styles for one or more nodes (batch) |
| `get_fill_image` | Image data from a node with image fill (base64 JPEG) |

### Write Tools (~7)

| Tool | Purpose |
|------|---------|
| `create_artboard` | Create new artboard with optional name and styles (width, height) |
| `write_html` | Parse HTML and add/replace nodes (insert-children or replace mode) |
| `set_text_content` | Set text content of one or more Text nodes (batch) |
| `rename_nodes` | Rename one or more layers (batch) |
| `duplicate_nodes` | Deep-clone nodes; returns new IDs and descendant ID map |
| `update_styles` | Update CSS styles on one or more nodes |
| `delete_nodes` | Delete one or more nodes and all descendants |

### Utility Tools

| Tool | Purpose |
|------|---------|
| `start_working_on_nodes` | Visual indicator that an agent is modifying artboards |
| *(~8 more not publicly documented)* | Likely include undo/redo, viewport control, export, etc. |

---

## File Storage & Collaboration

### Storage

- Designs live in **Paper's cloud platform** (app.paper.design), synced through the desktop app
- The MCP server operates on the **currently open file** in Paper Desktop
- The Pro plan includes unlimited storage

### Collaboration

Paper is currently in **open alpha** and focused on the **solo/small-team AI-first** use case:

- **No real-time multi-user collaboration** like Figma (yet)
- `start_working_on_nodes` provides basic "agent is working here" visual awareness
- A community MCP server exists for monitoring live design changes across collaborators
- The roadmap mentions improvements for file finding (LLM smart search, nested folders, tags)

### Pricing

- **Free**: 100 MCP calls/week
- **Pro** ($20/month): 1M MCP calls/week, video export, unlimited storage

---

## Mapping to PromptSlide

The conceptual parallel between Paper.design and PromptSlide is strong:

| Paper.design | PromptSlide Equivalent |
|---|---|
| HTML/CSS canvas (code-native) | React slide components (already code-native) |
| Desktop app + local MCP server | `promptslide studio` (Vite) + embedded MCP server |
| `get_jsx` / `get_screenshot` | Read slide .tsx source / screenshot via Playwright |
| `write_html` / `update_styles` | Edit slide .tsx files / Tailwind classes |
| `get_tree_summary` | Read deck-config.ts for slide structure |
| `create_artboard` | Create new slide component + register in deck-config |
| Cloud sync | Registry publish/clone system |
| `start_working_on_nodes` | Annotation system (already exists) |
| Artboards | Slides |
| Nodes | React components / JSX elements within slides |

### Key Insight

Paper needed a desktop app **specifically to host the local MCP server**. PromptSlide already has a local process (`promptslide studio` via Vite dev server). **The MCP server can be embedded directly into the existing Vite dev server** — no separate desktop app is needed for the MCP bridge.

---

## Proposed PromptSlide MCP Architecture

```
[Coding Agent (Claude Code / Cursor / Copilot / Codex / OpenCode)]
        |
        | Streamable HTTP @ 127.0.0.1:{vite-port}/mcp
        v
[promptslide studio — Vite Dev Server + Embedded MCP Server]
        |
        | File system (read/write .tsx slide components)
        v
[Slide Components + deck-config.ts + theme.ts + annotations.json]
        |
        | promptslide publish / clone
        v
[PromptSlide Registry (community sharing)]
```

### Why This Works

1. **No new process needed** — MCP endpoint mounts on the existing Vite dev server
2. **Hot reload integration** — slide changes via MCP trigger Vite HMR automatically
3. **Playwright already integrated** — `to-image` command provides screenshot capabilities
4. **Annotation system already exists** — HTTP endpoint at `/__promptslide_annotations`
5. **Code-native format** — slides are .tsx files, the format LLMs understand best

---

## Proposed MCP Tools

### Read Tools (~8)

| Tool | Purpose | Implementation Notes |
|------|---------|---------------------|
| `get_deck_info` | Deck name, slide count, theme summary, metadata | Read deck-config.ts + theme.ts |
| `get_slide_list` | All slides with titles, step counts, sections, order | Parse deck-config.ts |
| `get_slide_source` | TSX source code for a specific slide | Read from src/slides/*.tsx |
| `get_slide_screenshot` | PNG screenshot of a specific slide | Playwright (existing `to-image`) |
| `get_theme` | Current theme config (colors, fonts, logos) | Read theme.ts |
| `get_annotations` | Open annotations for a slide or entire deck | Existing annotation HTTP API |
| `get_layouts` | Available layout templates | Read src/layouts/*.tsx |
| `get_speaker_notes` | Speaker notes for a slide | Parse deck-config.ts |

### Write Tools (~8)

| Tool | Purpose | Implementation Notes |
|------|---------|---------------------|
| `create_slide` | Generate new slide component + register in deck-config | Write .tsx + update deck-config.ts |
| `update_slide_source` | Replace or patch slide component code | Write to src/slides/*.tsx |
| `update_slide_styles` | Modify Tailwind classes or inline styles | AST-aware edit of .tsx |
| `reorder_slides` | Change slide order in deck-config | Update deck-config.ts array |
| `delete_slide` | Remove slide component + deregister | Delete .tsx + update deck-config.ts |
| `update_theme` | Modify colors, fonts, logos in theme.ts | Write to theme.ts |
| `set_speaker_notes` | Add/update speaker notes for a slide | Update deck-config.ts |
| `resolve_annotation` | Mark annotation as resolved with a note | Existing annotation API |

### Utility Tools (~4)

| Tool | Purpose | Implementation Notes |
|------|---------|---------------------|
| `preview_slide` | Get live preview URL for a specific slide | Return Vite dev server URL with slide index |
| `export_pdf` | Trigger PDF export of entire deck | Playwright-based (existing capability) |
| `publish_deck` | Publish deck to the registry | Existing `promptslide publish` |
| `get_skill_instructions` | Return agent instructions for advanced workflows | Serve SKILL.md content |

---

## Advantages Over Current Skills Approach

| Current (Skills / Agent Instructions) | Proposed (MCP Server) |
|---|---|
| Agent must learn file conventions from SKILL.md | Structured tools with typed inputs/outputs |
| Agent reads/writes raw .tsx files directly | Semantic operations (`create_slide`, `update_theme`) |
| No visual feedback loop | `get_slide_screenshot` for visual verification |
| Works only with agents that support skills | Works with **any** MCP-compatible agent |
| No guardrails on file edits | Server validates operations, prevents broken deck state |
| Agent must parse deck-config manually | `get_slide_list` returns structured data |
| No way to detect "agent is working" | Could add working indicators (like Paper's `start_working_on_nodes`) |

### The Biggest Win

**Universal agent compatibility.** Any agent (Cursor, Copilot, Codex, OpenCode, Claude Code) could work with PromptSlide presentations without needing custom skill files for each platform. MCP is the universal adapter.

### Skills + MCP Coexistence

The MCP server doesn't replace skills — it complements them. Skills provide rich context and best practices (animation patterns, layout guidelines). MCP provides the structured tool interface. An ideal workflow uses both:

1. Agent reads skill instructions for design guidelines
2. Agent uses MCP tools for structured read/write operations
3. Agent uses `get_slide_screenshot` to verify visual output

---

## Collaboration Strategy

Paper's collaboration is actually minimal right now. PromptSlide could match or exceed it:

### Already Available

1. **Annotation-driven collaboration** — Humans pin visual feedback, agents read and resolve it
2. **Registry as collaboration** — Publish, clone, and fork community decks
3. **Git-based versioning** — Teams collaborate via branches and PRs

### Future Possibilities

1. **Multi-agent awareness** — "Agent X is editing slide Y" indicators
2. **Real-time sync** — WebSocket-based live updates for multi-user editing
3. **Conflict resolution** — OT/CRDT for concurrent slide edits
4. **Review workflows** — Comment threads on specific slides (extending annotations)

### Desktop App Consideration

Paper needed a desktop app for MCP. PromptSlide's `studio` command already provides the local server. However, a **desktop app (Electron/Tauri)** could still add value for:

- **Non-developer users** — Double-click to open, no terminal needed
- **System tray presence** — Always-on MCP server
- **Native file associations** — Open `.promptslide` project files directly
- **Auto-updates** — Seamless version management

This is a separate decision from MCP support and could come later.

---

## Sources

- [MCP - Paper Docs](https://paper.design/docs/mcp)
- [Paper - design, share, ship](https://paper.design/)
- [Paper.design Review: MCP, Features, Pricing](https://www.banani.co/blog/paper-design-mcp-review)
- [Figma MCP vs paper.design](https://sfailabs.com/guides/figma-mcp-vs-paper)
- [Paper.design: GPU Shaders, MCP and Vibe Coding](https://abduzeedo.com/paperdesign-gpu-shaders-mcp-and-vibe-coding-designers)
- [A Guide to Paper and Claude Code for Designers](https://adplist.substack.com/p/a-guide-to-paper-and-claude-code)
- [Paper Roadmap](https://paper.design/roadmap)
- [Paper Downloads](https://paper.design/downloads)
