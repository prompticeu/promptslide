# Creating a New Deck

## Step 1: Content Discovery

Before writing any code, ask the user:

1. **What is this presentation about?** (topic, key message)
2. **Who is the audience?** (investors, team, customers, conference)
3. **How many slides?** (suggest 5–10 for a focused deck, 10–15 for a detailed one)
4. **Do you have content ready?** (outline, bullet points, or should the agent draft it)

Use the answers to plan slide structure before scaffolding.

## Step 2: Style Direction

Determine the visual direction before writing any code:

1. **Ask if they have brand guidelines** — logo, colors, fonts. If yes, use those directly.
2. **If no brand guidelines**, suggest 2–3 presets from [style-presets.md](style-presets.md). Briefly describe each (one sentence + mood), let the user pick or mix.
3. **If the user wants something custom**, ask: dark or light? What mood? (professional, playful, dramatic, techy). Then build a custom direction from the building blocks in the presets.

The chosen direction determines what you configure:

- **Colors** → Theme CSS files with CSS custom properties (use `write_theme` or edit `themes/*.css`)
- **Fonts** → Theme CSS with `@theme inline { ... }`
- **Layouts** → HTML templates in `layouts/` (like PowerPoint masters)
- **Card styles & animations** → Applied per-slide based on the direction

Presets are starting points, not rigid templates. The user can change everything — it's all HTML, CSS, and Tailwind.

## Step 3: Scaffold and start

If the MCP server is connected, use the `create_deck` tool. Otherwise, use the CLI:

```bash
promptslide create my-deck
cd my-deck
bun install
bun run dev
```

This creates a project with:

```
my-deck/
├── deck.json           # Manifest — slide order, theme, transitions
├── slides/             # Slide HTML files
├── layouts/            # Slide master templates (like PowerPoint masters)
├── themes/             # CSS theme files (default theme auto-created)
├── assets/             # Images, logos, etc.
└── annotations.json    # Feedback/comments (optional)
```

`bun run dev` starts `promptslide studio` — the dev server with hot module replacement. Slides update instantly as files change.

## Step 4: Design Thinking

Before writing any slide code, commit to a clear aesthetic direction and plan the deck holistically. Generic, template-looking slides are worse than no slides at all.

### Pick a direction and commit

Choose a distinct visual personality — editorial, brutalist, luxury-minimal, bold geometric, warm organic — and execute it with precision throughout the deck. The key is intentionality, not intensity. A restrained minimal deck executed with perfect spacing and typography is just as strong as a bold maximalist one. What kills a deck is indecision: a little of everything, committing to nothing.

### Design each slide for its content

- **What does this content want to be?** A single powerful stat deserves to be big and alone on the slide. A comparison wants two sides. A list of features might work as clean typography with whitespace — not everything needs cards.
- **What's the rhythm of the deck?** Alternate between dense and spacious, dark and light, structured and freeform. Three white slides in a row is monotonous. Break runs with a dark "breather" slide, a full-bleed color block, or an asymmetric layout.
- **Where are the hero moments?** Every deck needs 1–2 slides that break the pattern — an oversized number, a bold color block, a single sentence with generous whitespace. These are what people remember.
- **What makes this deck UNFORGETTABLE?** Ask this before coding. If the answer is "nothing" — the design direction isn't strong enough.

Don't default to the first layout that comes to mind. Consider 2–3 options for each slide and pick the one that best serves the message.

**Share your design plan with the user before coding.** Briefly describe the visual direction, color strategy, and your layout approach for each slide (e.g., "slide 3: asymmetric two-column with oversized stat", "slide 7: dark hero slide — the most important in the deck"). Let them approve or adjust — don't just decide and start building.

## Step 5: Create your slides

Start writing slide HTML files. See the main SKILL.md for the slide format, animations, layouts, and theming reference.
