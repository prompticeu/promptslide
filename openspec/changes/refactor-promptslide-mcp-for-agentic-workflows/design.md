## Context

PromptSlide's current MCP surface is split across many narrow read/write/delete tool groups in `packages/cli/src/mcp/tools/`, while the runtime truth for whether a slide works lives in separate modules such as `dev-server.mjs`, `screenshot.mjs`, and `vite/plugin.mjs`. This creates two problems for coding agents: they can mutate slide files easily, but they cannot inspect the effective workspace contract or retrieve actionable diagnostics when the runtime fails.

The codebase already contains partial building blocks for a better feedback loop. Browser errors are forwarded from the Vite runtime, dev-server stderr is captured during startup, and render/export flows already share some common infrastructure. At the same time, key behavior such as step counting, import resolution, and slide resolution is duplicated across multiple modules, which increases drift between what the guides say, what the MCP returns, and what the runtime actually does.

This change treats the MCP as a runtime companion for coding agents rather than a large collection of artifact-specific CRUD tools. The goal is to expose the workspace and runtime truth directly, while consolidating duplicated logic behind shared services.

## Goals / Non-Goals

**Goals:**
- Replace the expanding artifact-specific authoring surface with a smaller set of general-purpose MCP workflows: `inspect`, `read`, `search`, `apply`, `validate`, and `render`.
- Surface structured diagnostics from static analysis, dev-server startup, browser/module errors, and render/export failures.
- Establish shared services for workspace discovery, runtime state, analysis, mutation, and rendering so all MCP tools use the same contract.
- Preserve a non-breaking migration path by keeping existing authoring tools as compatibility wrappers during the transition.
- Update guides and tool messaging so suggestions match the effective workspace conventions instead of hardcoded assumptions.

**Non-Goals:**
- Rebuild the PromptSlide presentation runtime, animation primitives, or preview UI from scratch.
- Remove all existing MCP tools in the first implementation pass.
- Generalize assets, annotations, or preview-app workflows unless they are directly affected by the new shared services.
- Solve slide quality or design taste automatically; this change improves observability and control, not creative judgment.

## Decisions

### Decision: Adopt a small core authoring surface

PromptSlide will expose six core workflows for agentic authoring:

- `inspect`: summarize workspace, deck, file, config, and runtime context
- `read`: return file contents by path or promptslide-aware target
- `search`: locate matching files or code patterns across the workspace
- `apply`: perform general-purpose workspace mutations
- `validate`: run layered checks and return structured diagnostics
- `render`: produce PNG, HTML, overview, or PDF artifacts

This tool surface is intentionally smaller than the current collection of slide/layout/component-specific CRUD tools. It gives agents fewer concepts to learn and keeps the value of the MCP focused on PromptSlide-specific behavior rather than filesystem ceremony.

Alternatives considered:
- Keep the current tool surface and add a few missing debugging tools. Rejected because it would preserve the current fragmentation and duplicated logic.
- Expose only `inspect`, `validate`, and `render`, and assume the host agent edits files directly. Attractive for coding-agent hosts, but too narrow for generic MCP clients that rely on the MCP for mutations.

### Decision: Build shared services behind the tool layer

The MCP implementation will be reorganized around shared services rather than tool modules owning their own logic.

Proposed service boundaries:

```text
MCP tools
  inspect / read / search / apply / validate / render
            |
            v
  WorkspaceService   AnalysisService   MutationService
  RuntimeService     RenderService     GuideService
            |
            v
  filesystem + manifest + Vite dev server + browser + export pipeline
```

- `WorkspaceService` owns deck resolution, file discovery, config summaries, and manifest snapshots.
- `AnalysisService` owns slide resolution, import alias resolution, step analysis, and diagnostics normalization.
- `RuntimeService` owns dev-server lifecycle, log capture, browser error capture, and runtime status snapshots.
- `RenderService` owns screenshot, HTML capture, overview generation, and PDF export.
- `MutationService` owns structured file and manifest operations.
- `GuideService` derives runtime-aware hints and examples from shared analysis instead of static hardcoded assumptions.

Alternatives considered:
- Keep the current per-tool logic and share only helpers opportunistically. Rejected because it would not eliminate drift between tools.

### Decision: Make validation the primary feedback loop

`validate` becomes the first-class debugging workflow. It will support workspace-, deck-, and slide-scoped validation and run checks in layers:

1. Workspace checks: manifest presence, referenced files, config discoverability
2. Static checks: slide resolution, imports, `meta.steps`, and related semantic warnings
3. Runtime checks: dev-server boot health, module load failures, browser errors
4. Render checks: screenshot/export readiness when explicitly requested

Diagnostics will be normalized into a structured response shape that includes phase, severity, target, message, and any available file or symbol context. `render` will reuse this structure on failure instead of returning a bare timeout.

Alternatives considered:
- Keep screenshots as the main verification mechanism. Rejected because screenshots fail too late and lose valuable failure context.

### Decision: Standardize on one runtime contract for imports and steps

The current codebase duplicates step detection and import resolution in multiple places. This change will make shared analysis the only source of truth for:

- slide file resolution
- alias/import resolution
- manifest-to-file mapping
- animation-step validation

`meta.steps` remains the runtime source of truth for navigation and export. Analysis may infer expected steps from `Animated` and `AnimatedGroup` usage, but that inference is used for diagnostics and warnings, not as a second execution contract.

Alternatives considered:
- Continue regex-based step detection as a separate contract. Rejected because it can diverge from runtime behavior and silently mislead agents.

### Decision: Keep migration non-breaking through compatibility wrappers

Existing authoring tools such as `create_slide`, `write_slide`, `edit_slide`, `write_layout`, `write_component`, and related read/delete helpers will remain available during the migration window. They will delegate to the new shared services and return a deprecation message pointing agents toward the new general-purpose workflows.

This allows PromptSlide to evolve the MCP without breaking existing agent integrations immediately.

Alternatives considered:
- Remove the old tools immediately. Rejected because it would create a large breaking change before the new workflows are proven.

### Decision: Keep mutations structured instead of exposing a raw shell escape hatch

The new `apply` tool will provide general-purpose mutations, but it will remain structured around files and manifest-aware operations rather than exposing arbitrary shell commands. PromptSlide's unique value is safe workspace-aware mutation plus runtime truth; a raw command runner would weaken that contract and duplicate capabilities that coding agents often already have.

Alternatives considered:
- Add a generic `run_command` tool. Rejected for the initial design because it expands the trust surface without improving PromptSlide-specific guarantees.

## Risks / Trade-offs

- [Scope creep across many MCP modules] -> Mitigation: extract shared services first, then migrate tools incrementally.
- [A general `apply` tool may become vague or unsafe] -> Mitigation: constrain it to structured operations, return affected paths, and couple it with validation output.
- [Validation may become too slow for iterative authoring] -> Mitigation: support scope-based validation modes and reuse warmed runtime state.
- [Compatibility wrappers can prolong old patterns] -> Mitigation: add explicit deprecation messaging and update guides to lead with the new workflows.
- [Diagnostics may still vary across Vite and browser layers] -> Mitigation: preserve raw messages while normalizing them into a consistent response schema.

## Migration Plan

1. Extract shared workspace, analysis, runtime, and render services behind the existing tools.
2. Add structured diagnostics capture for dev-server stderr, browser/module errors, and render failures.
3. Introduce `inspect`, `read`, `search`, `apply`, `validate`, and `render` on top of the shared services.
4. Update preview/export flows and guide generation to consume the shared runtime and analysis services.
5. Convert existing narrow tools into compatibility wrappers with deprecation guidance.
6. After the new workflows are stable, decide whether to remove redundant tools in a later major version.

Rollback strategy: keep the compatibility wrappers and shared services in place so the older tool surface remains functional if the new workflows need to be disabled or deferred.

## Open Questions

- Should `read`, `search`, and `apply` always ship in the MCP, or should some hosts prefer a thinner runtime-only surface when they already provide native file tools?
- Should `validate` include an optional compile-only mode that uses the standalone slide compiler, or should validation standardize entirely on the live runtime path?
- How much manifest-aware convenience should `apply` provide in its first version versus keeping it strictly path-oriented?
