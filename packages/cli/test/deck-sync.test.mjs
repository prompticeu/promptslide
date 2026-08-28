import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { replaceDeckConfig, toPascalCase } from "../src/utils/deck-config.mjs"
import {
  collectRegistrySlideSlugs,
  partitionDeckSlides,
  selectSlidesForPublish
} from "../src/utils/deck-sync.mjs"
import { pruneMissingLockfileItems } from "../src/utils/registry.mjs"

test("collectRegistrySlideSlugs only collects registry-provided slide source files", () => {
  const slugs = collectRegistrySlideSlugs([
    {
      files: [
        { target: "src/slides/", path: "slide-title.tsx" },
        { target: "src/slides/section/", path: "slide-detail.ts" },
        { target: "src/layouts/", path: "slide-layout.tsx" },
        { target: "public/", path: "slide-cover.png" }
      ]
    },
    { files: [{ target: "src\\slides\\", path: "slide-windows.tsx" }] }
  ])

  assert.deepEqual([...slugs], ["slide-title", "section/slide-detail", "slide-windows"])
})

test("partitionDeckSlides preserves published order and separates stale metadata", () => {
  const slides = [
    { slug: "slide-a", steps: 0 },
    { slug: "slide-b", steps: 1 },
    { slug: "slide-c", steps: 2 }
  ]

  const result = partitionDeckSlides(slides, new Set(["slide-a", "slide-c"]))

  assert.deepEqual(
    result.available.map(slide => slide.slug),
    ["slide-a", "slide-c"]
  )
  assert.deepEqual(
    result.missing.map(slide => slide.slug),
    ["slide-b"]
  )
})

test("generated deck config never imports stale registry metadata", () => {
  const cwd = mkdtempSync(join(tmpdir(), "promptslide-clone-"))
  try {
    mkdirSync(join(cwd, "src"), { recursive: true })
    const registryItems = [
      {
        files: ["slide-a.tsx", "slide-c.tsx", "slide-d.tsx"].map(path => ({
          target: "src/slides/",
          path
        }))
      }
    ]
    const metadata = ["slide-a", "slide-b", "slide-c", "slide-d"].map(slug => ({
      slug,
      steps: 0
    }))
    const { available } = partitionDeckSlides(metadata, collectRegistrySlideSlugs(registryItems))

    replaceDeckConfig(
      cwd,
      available.map(slide => ({
        componentName: toPascalCase(slide.slug),
        importPath: `@/slides/${slide.slug}`,
        steps: slide.steps
      }))
    )

    const config = readFileSync(join(cwd, "src", "deck-config.ts"), "utf-8")
    assert.doesNotMatch(config, /slide-b/)
    assert.ok(config.indexOf("slide-a") < config.indexOf("slide-c"))
    assert.ok(config.indexOf("slide-c") < config.indexOf("slide-d"))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test("selectSlidesForPublish follows deck-config order and skips unreferenced files", () => {
  const files = ["slide-d.tsx", "slide-a.tsx", "scratch.tsx", "slide-c.tsx"]
  const configured = [{ slug: "slide-a" }, { slug: "slide-c" }, { slug: "slide-d" }]

  const result = selectSlidesForPublish(files, configured)

  assert.deepEqual(result.selected, ["slide-a.tsx", "slide-c.tsx", "slide-d.tsx"])
  assert.deepEqual(result.unreferenced, ["scratch.tsx"])
  assert.deepEqual(result.missing, [])
})

test("selectSlidesForPublish reports missing configured files and supports --all", () => {
  const files = ["slide-a.tsx", "scratch.tsx"]
  const configured = [{ slug: "slide-a" }, { slug: "slide-b" }]

  const result = selectSlidesForPublish(files, configured, true)

  assert.deepEqual(result.selected, files)
  assert.deepEqual(result.unreferenced, ["scratch.tsx"])
  assert.deepEqual(result.missing, ["slide-b"])
})

test("selectSlidesForPublish rejects nested slide paths unsupported by registry member slugs", () => {
  const result = selectSlidesForPublish(
    ["slide-a.tsx"],
    [{ slug: "slide-a" }, { slug: "section/slide-b" }],
    false
  )

  assert.deepEqual(result.selected, ["slide-a.tsx"])
  assert.deepEqual(result.missing, ["section/slide-b"])
})

test("pruneMissingLockfileItems removes only entries whose tracked files are all gone", () => {
  const cwd = mkdtempSync(join(tmpdir(), "promptslide-lock-"))
  try {
    mkdirSync(join(cwd, "src", "slides"), { recursive: true })
    writeFileSync(join(cwd, "src", "slides", "present.tsx"), "export {}\n")
    const lock = {
      items: {
        "deck/missing": { files: { "src/slides/missing.tsx": "hash" } },
        "deck/present": { files: { "src/slides/present.tsx": "hash" } },
        "deck/partial": {
          files: {
            "src/slides/present.tsx": "hash",
            "src/slides/missing-too.tsx": "hash"
          }
        },
        deck: { files: {} }
      }
    }

    assert.deepEqual(pruneMissingLockfileItems(cwd, lock), ["deck/missing"])
    assert.deepEqual(Object.keys(lock.items), ["deck/present", "deck/partial", "deck"])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
