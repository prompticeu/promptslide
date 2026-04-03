## ADDED Requirements

### Requirement: Agents can validate a target before rendering
The PromptSlide MCP SHALL provide a `validate` workflow that accepts workspace-, deck-, or slide-scoped targets and returns structured diagnostics grouped by validation phase.

#### Scenario: Validate a slide with a missing import
- **WHEN** an agent validates a slide whose source references an unresolved import
- **THEN** the response identifies the failing phase and returns an actionable diagnostic describing the unresolved import

### Requirement: Render failures include actionable diagnostics
When a `render` request cannot produce the requested artifact, the system SHALL return the relevant diagnostics and recent runtime logs instead of only a generic timeout or selector failure.

#### Scenario: Render a PNG for a slide with a module-load failure
- **WHEN** an agent requests a PNG render for a slide whose module cannot load in the runtime
- **THEN** the response includes the browser or dev-server diagnostic that identifies the failing import or runtime error

### Requirement: Validation and rendering share one runtime contract
Validation, preview, screenshot, HTML capture, overview generation, and PDF export SHALL use shared slide resolution, import resolution, manifest analysis, and step semantics so that the same slide state produces consistent results across tools.

#### Scenario: Detect a step mismatch before export
- **WHEN** a slide declares `meta.steps` that does not match analyzed animation usage
- **THEN** validation reports the mismatch before an export or screenshot request proceeds

### Requirement: Rendering supports multiple artifact formats through one workflow
The PromptSlide MCP SHALL provide a single `render` workflow that can return slide PNG, slide HTML, deck overview PNG, and deck PDF outputs.

#### Scenario: Render a deck overview
- **WHEN** an agent requests an overview artifact for a deck
- **THEN** the system returns that artifact through the same `render` workflow used for other render formats
