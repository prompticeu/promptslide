## ADDED Requirements

### Requirement: Agents can inspect workspace and deck state
The PromptSlide MCP SHALL provide an `inspect` workflow that can return workspace-, deck-, or file-scoped summaries including available decks, manifest metadata, relevant source files, and current runtime status for the requested target.

#### Scenario: Inspect a specific deck
- **WHEN** an agent requests inspection for a deck target
- **THEN** the system returns the deck manifest summary, discovered slide/layout/component/theme files, and runtime status for that deck

### Requirement: Agents can inspect effective runtime conventions
The system SHALL expose the effective slide resolution, import alias resolution, and runtime-affecting configuration for a deck from shared analysis logic instead of relying on static guide text alone.

#### Scenario: Inspect alias resolution
- **WHEN** an agent requests convention or config details for a deck
- **THEN** the system returns the effective alias mappings and the config sources that define them

### Requirement: Agents can read and search deck files through general-purpose tools
The PromptSlide MCP SHALL provide general-purpose `read` and `search` tools that operate on deck files without requiring separate slide, layout, or component-specific read tools.

#### Scenario: Search for a layout import
- **WHEN** an agent searches a deck for references to a layout or component
- **THEN** the system returns matching files and excerpts across slides, layouts, components, and supporting source files

### Requirement: Tool guidance reflects effective workspace conventions
Any MCP response that suggests imports, file paths, or workflow hints SHALL derive those suggestions from shared workspace analysis so that the guidance matches the actual workspace contract.

#### Scenario: Compatibility response suggests an import path
- **WHEN** a compatibility tool responds after creating or updating a layout
- **THEN** any suggested import path matches the effective import convention for that workspace
