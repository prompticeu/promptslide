import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { analyzeStepMetadata } from "./analysis.mjs"
import { createDiagnostic, createResult } from "./diagnostics.mjs"
import { withLegacyNotice } from "./legacy.mjs"
import { createDeckWorkspace, applyWorkspaceOperations } from "./mutations.mjs"
import { buildImportSpecifier, getDeckSummary, inspectFile, searchWorkspaceFiles } from "./workspace.mjs"
import { validateWorkspaceTarget } from "./validate.mjs"

async function withTempWorkspace(fn) {
  const root = mkdtempSync(join(tmpdir(), "promptslide-mcp-test-"))
  try {
    return await fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test("step analysis warns when meta.steps is missing", () => {
  const result = analyzeStepMetadata(`
    import { Animated } from "promptslide"
    export default function Slide() {
      return <Animated step={2}>Hello</Animated>
    }
  `, { path: "src/slides/slide-hero.tsx", target: "hero" })

  assert.equal(result.declaredSteps, null)
  assert.equal(result.inferredSteps, 2)
  assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), ["meta.steps.missing"])
})

test("workspace services report alias hints and unresolved imports", async () => {
  await withTempWorkspace(async root => {
    const { deckSlug, deckPath } = createDeckWorkspace(root, { name: "Smoke Deck" })
    applyWorkspaceOperations(deckPath, [
      {
        type: "write-file",
        path: "src/layouts/master.tsx",
        content: `export function MasterLayout({ children }) { return <div>{children}</div> }\n`,
      },
      {
        type: "upsert-slide",
        id: "hero",
        content: `import { MasterLayout } from "@/layouts/master"
import { Missing } from "@/components/missing"
import { Animated } from "promptslide"

export const meta = { steps: 1 }

export default function Hero() {
  return <MasterLayout><Animated step={2}>Hi</Animated></MasterLayout>
}
`,
      },
    ])

    const summary = getDeckSummary(deckPath)
    const file = inspectFile(deckPath, "src/slides/slide-hero.tsx")
    const validation = await validateWorkspaceTarget({
      deckRoot: root,
      deck: deckSlug,
      scope: "slide",
      slide: "hero",
      includeRuntime: false,
    })

    assert.equal(buildImportSpecifier(deckPath, {
      kind: "layouts",
      name: "master",
      fromFile: join(deckPath, "src", "slides", "slide-hero.tsx"),
    }), "@/layouts/master")
    assert.equal(file.kind, "slide")
    assert.equal(file.steps, 1)
    assert.equal(searchWorkspaceFiles(deckPath, { query: "Animated" }).length, 2)
    assert.deepEqual(summary.slides[0].diagnostics.map(diagnostic => diagnostic.code), [
      "meta.steps.mismatch",
      "import.unresolved",
    ])
    assert.equal(validation.ok, false)
    assert.deepEqual(validation.summary, {
      total: 2,
      errors: 1,
      warnings: 1,
      info: 0,
    })
  })
})

test("structured diagnostics group phases and severity counts", () => {
  const diagnostics = [
    createDiagnostic({ phase: "static", severity: "warning", message: "warn" }),
    createDiagnostic({ phase: "runtime", severity: "error", message: "boom" }),
  ]

  const result = createResult({ target: "slide:hero", diagnostics })
  assert.equal(result.ok, false)
  assert.equal(result.phases.static.length, 1)
  assert.equal(result.phases.runtime.length, 1)
  assert.deepEqual(result.summary, {
    total: 2,
    errors: 1,
    warnings: 1,
    info: 0,
  })
})

test("legacy notice helper annotates payloads", () => {
  assert.deepEqual(withLegacyNotice({ ok: true }, {
    tool: "get_slide",
    preferred: "read { slide }",
    note: "Prefer read.",
  }), {
    ok: true,
    deprecated: true,
    legacyTool: "get_slide",
    preferredWorkflow: "read { slide }",
    deprecationNote: "Prefer read.",
  })
})
