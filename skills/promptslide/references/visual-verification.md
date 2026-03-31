# Visual Verification

Always verify slides visually after creating or editing them. HTML and Tailwind classes can look correct in source but render incorrectly.

## With MCP Server

When the PromptSlide MCP server is connected, use these tools:

- **`get_screenshot`** — capture a single slide as a base64 PNG. Call after every slide change.
- **`get_deck_overview`** — thumbnail grid of all slides. Use periodically to check consistency across the deck.

## Without MCP (CLI)

```bash
npx promptslide to-image <slide-path> [-o <output-file>]
```

- `<slide-path>`: Slide file relative to the deck root (e.g. `slides/hero.html`). This is a **positional argument** — pass the file path directly, not a flag.
- `-o <output-file>`: Optional output path. Defaults to `<slide-name>.png` in the current directory.

## What to Check

- Layout and spacing look correct
- Text is readable and not clipped
- Colors and styling match expectations
- Animations render in their final state (all steps shown)
- Content fits within the 1280×720 container
- Consecutive slides have visual variety (use `get_deck_overview`)

## Common Issues

- **Content not centering** — wrapper div from layout slot injection breaks flex chain. Wrap the `<!-- content -->` marker in a flex container.
- **Colors invisible** — text color too close to background. Check contrast.
- **Text overflow** — content exceeds 1280×720. Reduce font size or split across slides.

If something looks off, iterate on the slide code and re-verify until it looks right.
