## ADDED Requirements

### Requirement: Agents can mutate PromptSlide workspaces through one general-purpose tool
The PromptSlide MCP SHALL provide an `apply` workflow that supports create, update, rename, and delete operations across slide, layout, component, theme, and manifest files without requiring separate artifact-specific write tools.

#### Scenario: Create a slide and manifest entry in one workflow
- **WHEN** an agent applies a mutation that adds a new slide file and the corresponding manifest entry
- **THEN** the system persists both changes in one workflow and reports success only after both operations complete

### Requirement: Mutation responses report affected files and validation follow-up
After a successful mutation, the system SHALL return the affected file paths and any requested or automatic validation warnings relevant to the changed workspace state.

#### Scenario: A mutation introduces a step warning
- **WHEN** an agent applies a slide mutation that changes animation steps
- **THEN** the response includes the changed file paths and any step-validation warning tied to that slide

### Requirement: Existing authoring tools remain available during migration
PromptSlide SHALL keep the existing slide, layout, and component authoring tools available as compatibility wrappers during the migration to the general-purpose tool surface.

#### Scenario: A legacy authoring tool is used during migration
- **WHEN** an agent calls an existing slide or layout authoring tool during the migration window
- **THEN** the system completes the request via the shared services and returns a deprecation notice with the preferred general-purpose workflow
