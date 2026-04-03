## 1. Shared analysis and runtime foundations

- [x] 1.1 Extract shared workspace and slide analysis utilities for deck resolution, slide file resolution, alias/config inspection, and step analysis from the existing MCP and Vite modules.
- [x] 1.2 Add a runtime service that manages dev-server lifecycle, captures startup stderr, records forwarded browser/module errors, and exposes recent runtime status and logs.
- [x] 1.3 Normalize validation and render diagnostics into a shared response shape that can be reused by multiple MCP tools.

## 2. General-purpose MCP workflows

- [x] 2.1 Implement an `inspect` workflow that returns workspace-, deck-, or file-scoped summaries derived from the shared workspace and runtime services.
- [x] 2.2 Implement general-purpose `read` and `search` workflows for PromptSlide workspaces and wire them to the shared analysis layer.
- [x] 2.3 Implement a structured `apply` workflow for file and manifest mutations that reports affected paths and can attach validation warnings.
- [x] 2.4 Implement a `validate` workflow that supports workspace, deck, and slide scopes and reports diagnostics by validation phase.
- [x] 2.5 Implement a unified `render` workflow that supports slide PNG, slide HTML, deck overview PNG, and deck PDF outputs.

## 3. Compatibility and guide migration

- [x] 3.1 Refactor existing slide/layout/component read and write tools to delegate to the shared services and return deprecation guidance toward the new workflows.
- [x] 3.2 Update preview and export flows to consume the shared runtime, analysis, and render services so failure reporting stays consistent.
- [x] 3.3 Update MCP guides and tool-generated hints so import paths, step guidance, and workflow recommendations match the effective workspace contract.

## 4. Validation and rollout checks

- [x] 4.1 Add tests or verification coverage for alias resolution, step-analysis warnings, structured diagnostics, and compatibility-wrapper behavior.
- [x] 4.2 Run end-to-end verification on create/edit/validate/render flows to confirm actionable error reporting replaces generic screenshot timeouts.
- [x] 4.3 Document the migration path for existing MCP consumers, including the preferred new workflows and the compatibility period for legacy tools.
