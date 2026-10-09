# Development source editor

Run `promptslide studio` and choose **Edit** in the existing top-right toolbar. The editor is injected by the development Vite plugin. Production builds, registry previews, embeds, and export pages do not load it. No editable-component migration is needed.

## Workflow

- Double-click literal text to edit it in place. Select an existing element, or use Slide elements. Shift-click selects several elements. Double-click a selected group to reach the element under the pointer; click outside the slide to deselect.
- Edit literal text and title/subtitle/eyebrow properties, appearance, image URLs, or public asset paths in Design. Arrange contains positioning and alignment controls.
- Drag selection outlines to move. The lower handle resizes; the upper handle rotates. Arrow keys nudge by one design pixel, Shift by ten. Alt disables snapping. All geometry is measured in the 1280 × 720 design canvas.
- Align selected elements along either axis or distribute three or more with equal gaps. Bring forward / Send back set stacking order.
- For images, adjust the frame size, objectFit, objectPosition, and inset crop.
- Select a range in Text and apply bold, italic, or underline. Save existing text changes first. Range formatting creates ordinary styled JSX spans, which can subsequently be selected individually.
- Structure supports inserting text, shapes, and images into JSX containers and duplicating/deleting direct JSX children. Root components and expressions cannot be deleted. Duplicates preview immediately and support Undo and Discard; save to edit copies independently. Insertions render after Save; range formatting previews immediately.
- Undo/redo affects the buffered draft. Save batches edits to source; Discard restores the source rendering. Close requires resolving unsaved changes. The browser tab retains its draft across hot reloads. Export draft downloads the pending operations for recovery.
- Editing uses the original viewer canvas, styling, and animation wrappers. Leave Edit to reveal steps normally; opening Edit preserves the currently visible content.

## Source semantics

Instrumentation adds source coordinates and a SHA-256 file revision only to the transformed development module. The original TSX is unchanged until Save. Intrinsic DOM elements and `motion.*` elements are supported. Source files must resolve inside the project's `src/` directory; symlinks outside it are rejected.

A style change belongs to a JSX definition, so it affects all instances of that definition, including shared layouts. Movement uses the individual CSS `translate` property, preserving normal flex/grid flow and existing Motion transforms; rotation uses `rotate`. Resizing sets explicit frame dimensions. It does not convert the deck into an absolute-positioned document.

For direct local `array.map(item => <p>{item.title}</p>)` expressions over literal object arrays, text edits address the selected array item. Imported arrays, spreads, ambiguous bindings, computed expressions, and mixed children are intentionally read-only. Edit those expressions in code. Simple local component text props are resolved automatically when their rendered text is selected, without requiring the component to forward DOM metadata. Ambiguous or imported prop relationships remain unsupported. Shared appearance controls require opting in when multiple matching instances are present on the current slide.

Every batch checks all file revisions and validates all resulting TSX syntax before writing. Stale edits receive HTTP 409. Export or discard the draft and reselect from the current source; there is no force-overwrite button. Parent/child structural edits that overlap must be saved separately. This is optimistic concurrency protection, not a filesystem transaction across external processes. A save failure rolls back files still matching this operation's output.

The endpoint uses a per-server random token, checks cross-site fetches, limits payload size and operation counts, and only runs in Vite serve mode. Keep development servers on trusted interfaces, as with ordinary Vite source access.

## Verification

- `node --test packages/cli/test/editor.test.mjs`: source edits, escaping, conflicts, batch validation, path restrictions, and array instances.
- `node packages/cli/test/editor.browser.mjs`: isolated temporary deck; text/history, save/reload, concurrent edits, scaled dragging, and production bundle exclusion. Requires the package's Playwright Chromium installation.
- `tsc -p packages/cli/tsconfig.json --noEmit`: editor and engine types.

Implementation uses TypeScript's JSX parser and original-range patches. No OpenSlide source code is vendored.
