import assert from "node:assert/strict"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  mkdirSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { launchChromium } from "../src/utils/export.mjs"
import { projectRevision } from "../src/utils/pptx/export.mjs"
import { ensureTsConfig } from "../src/utils/tsconfig.mjs"

test("starting another capture leaves an unchanged tsconfig untouched", () => {
  const cwd = mkdtempSync(join(tmpdir(), "promptslide-config-"))
  try {
    const path = join(cwd, "tsconfig.json")
    ensureTsConfig(cwd)
    assert.ok(JSON.parse(readFileSync(path, "utf8")).compilerOptions.paths["promptslide"])
    utimesSync(path, 1000000, 1000000)
    const before = statSync(path).mtimeMs
    ensureTsConfig(cwd)
    assert.equal(
      statSync(path).mtimeMs,
      before,
      "Avoid a Vite full reload during an existing export"
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test("revision follows linked assets, detects same-size changes and rejects cycles", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "promptslide-revision-"))
  try {
    mkdirSync(join(cwd, "src"))
    mkdirSync(join(cwd, "public"))
    mkdirSync(join(cwd, "shared"))
    const asset = join(cwd, "shared/image.svg")
    writeFileSync(asset, "first")
    symlinkSync(join(cwd, "shared"), join(cwd, "public/shared"), "dir")
    const before = await projectRevision(cwd)
    assert.equal(await projectRevision(cwd), before)
    const modified = statSync(asset).mtime
    writeFileSync(asset, "other")
    utimesSync(asset, modified, modified)
    assert.notEqual(await projectRevision(cwd), before)
    symlinkSync(join(cwd, "shared"), join(cwd, "shared/cycle"), "dir")
    await assert.rejects(projectRevision(cwd), /symlink cycle/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test("capture retains the first browser launch and propagates launch failures", async () => {
  let launches = 0
  const browser = {
    close() {
      throw new Error("Probe must not close the real browser")
    }
  }
  assert.equal(
    await launchChromium({
      launch: async () => {
        launches++
        return browser
      }
    }),
    browser
  )
  assert.equal(launches, 1)
  await assert.rejects(
    launchChromium({
      launch: async () => {
        throw new Error("Permission denied")
      }
    }),
    /Permission denied/
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    launchChromium(
      {
        launch: async () => {
          launches++
          return browser
        }
      },
      {},
      controller.signal
    )
  )
  assert.equal(launches, 1)
})
