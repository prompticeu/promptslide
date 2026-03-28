# PromptSlide MCP Architecture — Paper.design Analysis

> Analysis of how [paper.design](https://paper.design) implements MCP and desktop app integration, and how similar patterns could be applied to the PromptSlide registry.

## Table of Contents

- [Paper.design MCP Summary](#paperdesign-mcp--complete-summary)
- [How This Maps to PromptSlide](#how-this-maps-to-promptslide)
- [Proposed MCP Tools](#proposed-mcp-tools)
- [Proposed Architecture](#proposed-architecture)
- [Implementation Phases](#implementation-phases)
- [Key Design Decisions](#key-design-decisions)
- [Sources](#sources)

---

## Paper.design MCP — Complete Summary

### What It Is

A **desktop design tool** (Mac, Windows, Linux) by Stephen Haney (creator of Modulz/Radix UI). Still in **open alpha** (launched March 5, 2026). Its core differentiator: the canvas is **DOM-native** — real HTML/CSS, not a proprietary vector format.

### Architecture

- Desktop app runs a **local MCP HTTP server** at `http://127.0.0.1:29979/mcp`
- Uses **Streamable HTTP** transport (not stdio)
- Server starts automatically when a file is opened — zero config
- Setup: `claude mcp add paper --transport http http://127.0.0.1:29979/mcp --scope user`

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

### MCP Tools (~24 total)

**Read (9):**

| Tool | Purpose |
|------|---------|
| `get_basic_info` | File name, page name, node count, artboard list with dimensions |
| `get_selection` | Currently selected nodes (IDs, names, types, size, artboard) |
| `get_node_info` | Node details by ID (size, visibility, lock, parent, children, text content) |
| `get_children` | Direct children of a node (IDs, names, types, child counts) |
| `get_tree_summary` | Compact text summary of subtree hierarchy (optional depth limit) |
| `get_screenshot` | Base64 screenshot of a node (1x or 2x scale) |
| `get_jsx` | JSX output for node and descendants (Tailwind or inline-styles format) |
| `get_computed_styles` | Computed CSS styles for one or more nodes (batch) |
| `get_fill_image` | Image data from a node with image fill (base64 JPEG) |

**Write (7):**

| Tool | Purpose |
|------|---------|
| `create_artboard` | Create new artboard with optional name and styles (width, height) |
| `write_html` | Parse HTML and add/replace nodes (insert-children or replace mode) |
| `set_text_content` | Set text content of one or more Text nodes (batch) |
| `rename_nodes` | Rename one or more layers (batch) |
| `duplicate_nodes` | Deep-clone nodes; returns new IDs and descendant ID map |
| `update_styles` | Update CSS styles on one or more nodes |
| `delete_nodes` | Delete one or more nodes and all descendants |

**Utility (~8):**

| Tool | Purpose |
|------|---------|
| `start_working_on_nodes` | Visual "agent is editing" indicator on artboards |
| *(~7 more not publicly documented)* | Likely include undo/redo, viewport control, export, etc. |

### How Agent Interaction Works

1. Agent **reads** the canvas — tree structure, screenshots, JSX
2. Agent **writes HTML/CSS** — Paper renders it as visual design nodes
3. Agent **exports code** — `get_jsx` returns production-ready React+Tailwind
4. **HTML/CSS is the lingua franca** — no format translation, LLMs understand it natively

**Key difference from Figma MCP:** Figma's MCP is **read-only** (3 tools). Paper is **bidirectional** (24 tools, read + write).

### File Storage

- Stored in **Paper's cloud platform** (app.paper.design), synced through the desktop app
- The MCP server operates on the **currently open file** in Paper Desktop
- Exports as standard **React + Tailwind JSX**
- Pro plan includes unlimited storage

### Collaboration

- Human-agent collaboration via MCP is the primary model
- `start_working_on_nodes` shows visual indicators when an agent is editing
- Traditional multiplayer (live cursors) **not confirmed yet** — still alpha, focused on solo/small-team AI-first use case
- Roadmap mentions file finding improvements (LLM smart search, nested folders, tags)
- Community plugins: `paper-design/agent-plugins` (Cursor, Claude), `ripgrim/paper-mcp` (community MCP wrapper)

### Open Source

- `@paper-design/shaders` — canvas/WebGL shader library (PolyForm Shield license)
- `ripgrim/paper-mcp` — community-built MCP wrapper for monitoring live design changes

### Pricing

- **Free:** 100 MCP tool calls/week
- **Pro ($20/mo, or $16/mo annual):** ~1M MCP calls/week + video export + unlimited storage

---

## How This Maps to PromptSlide

### What You Already Have (~60% coverage)

| Paper Capability | PromptSlide Equivalent |
|------------------|------------------------|
| Node tree / artboards | Registry items (slides, layouts, decks) |
| File storage + versioning | Vercel Blob + `registryItemVersions` table |
| Code format (JSX) | Registry files are already React+Tailwind |
| Multi-user collaboration | Org/member model with RLS |
| Visual preview | `preview-renderer` (Vite app, port 3001) |
| Feedback/annotations | `registryAnnotations` table |
| Publishing workflow | `/api/publish` with approval workflow |
| Search/discovery | `/api/r` public registry search |
| Auth for agents | API keys via Better Auth |

### What You'd Need to Build

1. **MCP server wrapper** — expose existing API as MCP tools
2. **Desktop app shell** — local-first experience with embedded MCP server
3. **Screenshot tool** — headless rendering for agent visual feedback
4. **Visual slide editor** — the biggest gap, drag-and-drop canvas

---

## Proposed MCP Tools

### Read

| Tool | Purpose | Wraps |
|------|---------|-------|
| `get_deck_info` | Deck metadata, slide count, theme | `GET /api/items/[id]` |
| `get_slide_content` | Slide JSX/HTML content | `GET /api/items/[id]/files` |
| `get_slide_screenshot` | Visual preview as base64 | preview-renderer headless |
| `get_deck_tree` | Ordered slide manifest | `deckConfig` field |
| `search_registry` | Search available components | `GET /api/r` |
| `get_theme` | Current theme/styles | theme registry items |
| `get_annotations` | Feedback on slides | `GET /api/items/[id]/annotations` |

### Write

| Tool | Purpose | Wraps |
|------|---------|-------|
| `create_deck` | Create new empty deck | `POST /api/publish` (type: deck) |
| `create_slide` | Add slide to deck | `POST /api/publish` (type: slide) |
| `update_slide_content` | Modify slide JSX | `PATCH /api/items/[id]` |
| `reorder_slides` | Change slide order | Update `deckConfig` |
| `set_theme` | Apply theme to deck | Theme registry items |
| `publish_deck` | Publish to registry | `POST /api/publish` |
| `add_from_registry` | Pull a component | `GET /api/r/[slug]` |
| `delete_slide` | Remove slide | `DELETE /api/items/[id]` |
| `start_editing` | Show "agent is working" indicator | New: activity status |

---

## Proposed Architecture

```
┌─────────────────────┐     MCP (HTTP)      ┌──────────────────────┐
│  Coding Agent        │◄──────────────────►│  PromptSlide Desktop  │
│  (Claude, Cursor,    │                     │  App / MCP Server     │
│   Windsurf, etc.)    │                     │                       │
└─────────────────────┘                      │  ┌─────────────────┐ │
                                             │  │ Slide Editor     │ │
                                             │  │ (visual canvas)  │ │
                                             │  └─────────────────┘ │
                                             │  ┌─────────────────┐ │
                                             │  │ Preview Renderer │ │
                                             │  │ (already exists) │ │
                                             │  └─────────────────┘ │
                                             └──────────┬───────────┘
                                                        │
                                                        ▼
                                             ┌──────────────────────┐
                                             │  Registry API         │
                                             │  (already exists)     │
                                             └──────────────────────┘
```

---

## Implementation Phases

### Phase 1 — MCP Server (no desktop app needed)

- Add MCP HTTP endpoint to your Next.js app (or standalone process)
- Wrap existing API routes as MCP tools
- Auth via API keys (already supported)
- Agents can create/read/update slides immediately
- **Smallest effort, highest validation value**

### Phase 2 — Desktop App Shell (Tauri)

- Wrap preview-renderer + minimal editor in **Tauri** (Rust, ~10MB binary vs Electron's ~150MB)
- Run MCP server locally on a fixed port
- Add `get_slide_screenshot` via headless preview-renderer
- Offline-first with sync to registry
- Auto-start MCP server when app opens (like Paper does)

### Phase 3 — Visual Slide Editor

- Drag-and-drop canvas where agents and humans co-edit
- Agent edits appear live in the editor
- Human edits readable by agents via MCP
- Real-time presence indicators (WebSocket/SSE) — leverage existing `registryActivity` table

---

## Key Design Decisions

1. **HTML/CSS as interchange** — Your slides are already React+Tailwind, same as what agents write. No translation layer needed. This is Paper's biggest architectural win and you get it for free.

2. **Cloud-first, not local-first** — Paper stores in the cloud with desktop sync. For PromptSlide, the registry IS the source of truth. Desktop app acts as a local cache. Simpler to start with.

3. **Tauri over Electron** — ~10MB binary, native performance, Rust backend for MCP server, much better resource usage.

4. **Phase 1 is the real test** — The MCP server alone (no desktop app) validates whether agents can productively build presentations through your API. If that works well, Phases 2-3 are about UX polish, not core capability.

5. **Skills + MCP coexistence** — MCP doesn't replace skills, it complements them. Skills provide rich context and design best practices. MCP provides the structured tool interface. An ideal workflow uses both.

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
- [Paper MCP Server on LobeHub](https://lobehub.com/mcp/garaevruslan-paper-design-mcp)
