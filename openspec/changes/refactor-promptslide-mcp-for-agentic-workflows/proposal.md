## Why

PromptSlide's MCP is optimized for happy-path deck creation, but coding agents build decks through repeated debugging and visual verification. Today the MCP hides the runtime state that actually determines success, so agents can edit files but still fail blindly on import errors, step mismatches, and screenshot timeouts without actionable feedback.

## What Changes

- Introduce a smaller set of general-purpose MCP workflows for inspection, validation, rendering, and mutation instead of continuing to add narrow slide/layout/component CRUD tools.
- Surface dev-server, browser, compile, and render diagnostics directly in MCP responses so failures return actionable causes rather than generic timeouts.
- Consolidate import resolution, step analysis, manifest inspection, and render state behind shared services so all tools use the same source of truth.
- Add explicit workspace and deck introspection so agents can inspect file structure, relevant config, runtime status, and existing conventions before making changes.
- Update guides and tool messaging to reflect the actual runtime contract and deprecate misleading hints that disagree with the implementation.

## Capabilities

### New Capabilities
- `workspace-introspection`: Let agents inspect PromptSlide workspaces, decks, files, config, and runtime context through general-purpose discovery workflows.
- `validation-and-rendering`: Let agents validate slides and decks, retrieve structured diagnostics, and render visual or export artifacts from the same runtime truth.
- `workspace-mutations`: Let agents apply general-purpose workspace changes for slides, layouts, components, themes, and manifests without needing one MCP tool per file category.

### Modified Capabilities

None.

## Impact

- Affected code: `packages/cli/src/mcp/**/*`, `packages/cli/src/vite/**/*`, `packages/cli/src/core/types.ts`, MCP app preview wiring, and guide content under `packages/cli/src/mcp/guides/`.
- Affected APIs: PromptSlide MCP tool surface, tool response schemas, and error handling behavior.
- Affected systems: Vite dev server lifecycle, browser error forwarding, screenshot/render flows, and spec/runtime step-count handling.
