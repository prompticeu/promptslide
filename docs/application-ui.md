# Application UI

PromptSlide's toolbar, view/presentation menus, inspector, loop settings, comments and source editor share components in `packages/cli/src/core/ui/`. They use Base UI primitives, CVA button variants and a local shadcn-style composition. This is application chrome; slide authors keep using their own layouts, Tailwind classes and theme.

## Components and appearance

Use these wrappers when changing application controls:

- `button.tsx`: ghost, outline, primary and destructive variants; `size="icon"`; `selected` centralizes the orange active state. `variant="unstyled"` preserves custom canvas geometry for thumbnails, selection handles and annotation pins. `title` also supplies the shared tooltip.
- `input.tsx`, `checkbox.tsx`, `field.tsx`, `select.tsx`, `slider.tsx`: labeled form controls, with existing editor draft callbacks preserved.
- `tabs.tsx`, `disclosure.tsx`: inspector navigation and collapsible control sections. Inspector panels keep visited content mounted so local drafts survive switching panels.
- `dropdown-menu.tsx`, `tooltip.tsx`, `popover.tsx`, `dialog.tsx`: keyboard behavior, focus handling and application-themed portal containers. Menu content and tooltip positioners load on demand; pointer/focus intent starts preloading.

The private `--ps-*` application tokens and shared control styles live in `app.source.css`. Keep source-specific editor layout in `src/editor/studio.css`. Selected controls use the application's orange token; deck branding does not recolor them. Prefer a component variant over repeating state styles at each call site.

## CSS boundary and slide rendering

`ApplicationRoot` mounts chrome in an open Shadow DOM with its own reset, font, colors and portal host. All popup wrappers portal into that host, including the editor's separate React root. Fullscreen therefore keeps menus inside the fullscreen element. Document selectors cannot directly find shadow controls: use `queryApplication`, `applicationRoots`, `eventElement` and `activeElement` from `ui/dom.ts` where needed. Do not patch browser document APIs.

Authored slides remain light-DOM elements assigned to named `SlideSlot` slots. Their existing document styles, semantic theme variables, source metadata and export selectors continue to work. Slot content explicitly restores the author's inherited font/color properties and custom properties so the UI reset does not change slide typography. Slide theme/style hot reload refreshes this inheritance. Application styling does not rely on the deck's Tailwind scan.

Shadow DOM alone does not isolate `rem` from the document root. The UI build normalizes application `rem` dimensions to pixels using a 16px baseline, keeping controls stable when a slide changes `html { font-size }`. Annotation capture and pins sit beside the transformed slide canvas; the comment form uses a viewport-positioned popover so controls stay readable at mobile scale.

## Build and SDK consumers

After changing application styles, classes or controls, run:

```sh
bun run --cwd packages/cli build
```

`build:ui` runs only the stylesheet generator. `scripts/build-ui.mjs` compiles the explicit core/editor Tailwind sources and writes `app-styles.ts`; commit that generated file with the source. The package build includes this step before tsup. The stylesheet is embedded in the UI JavaScript, so published `SlideDeck` consumers need no application CSS import, Tailwind plugin or shadcn configuration. Their authored slides still need their own stylesheet as usual. Keep Base UI imports at component subpaths.

Studio optimizes the complete primitive import list together and stores its Vite cache in the deck's own `.vite/promptslide` directory. Tailwind's project base is the deck directory. If adding a new Base UI primitive, update `optimizeDeps.include` to avoid a second React dependency generation during editing.

The development plugin injects the source editor only for local Studio. Production decks retain viewer controls, comments and loop settings, while excluding editor components, source instrumentation and source-write endpoints. Settings, comments and annotation entry forms are deferred until used. Direct PDF/export routes bypass application chrome; the static browser-print fallback keeps its page/slide rules in light DOM because those rules must reach the authored canvases.

## Validation

Run from the repository root:

```sh
bun run test
bunx tsc --noEmit
bunx tsc -p packages/cli/tsconfig.json --noEmit
bun run lint
node packages/cli/test/application-ui.browser.mjs
PLAYWRIGHT_CHANNEL=chrome node packages/cli/test/editor.browser.mjs
PLAYWRIGHT_CHANNEL=chrome node packages/cli/test/loop-browser.mjs
node packages/cli/test/application-bundle.mjs
node packages/cli/test/application-performance.browser.mjs
```

The application suite uses installed Chrome and temporary isolated decks. It verifies hostile slide styles, live theme changes, keyboard/focus behavior, mobile annotations, the separate editor root, a real PDF download, print scaling and a plain Vite SDK consumer. The editor and loop suites exercise the original source/persistence and playback paths. The editor suite has a known retained Node handle after all assertions complete; terminate that completed process if necessary.

The production harness compares an archived feature baseline (`6dc2f38`) with the current checkout in fresh Node processes. It counts embedded application CSS in JavaScript totals and checks that no editor modules enter production. See [the final measurement report](application-ui-bundle-report.md) for transfer sizes, throttled measurements and limitations. The earlier [feasibility report](base-ui-bundle-report.md) is retained as historical evidence.
