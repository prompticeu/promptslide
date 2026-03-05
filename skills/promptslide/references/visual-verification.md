# Visual Verification

Capture a slide as a PNG screenshot to visually verify it renders correctly.

## Usage

```bash
npx promptslide to-image <slide-path> [-o <output-file>]
```

- `<slide-path>`: Slide file relative to project root (e.g. `src/slides/slide-title.tsx`)
- `-o <output-file>`: Optional output path. Defaults to `<slide-name>.png` in the current directory.

## Workflow

1. Identify the slide file. If unclear, glob for `src/slides/**/*.tsx`.
2. Run `npx promptslide to-image <slide-path>` from the project root.
3. Read the resulting PNG with the Read tool to visually inspect it.
4. If the slide has visual issues (layout, spacing, content), fix the code and re-capture.

## What to Check

- Layout and spacing look correct
- Text is readable and not clipped
- Colors and styling match expectations
- Animations render in their final state (all steps shown)

If something looks off, iterate on the slide code and re-capture until it looks right.
