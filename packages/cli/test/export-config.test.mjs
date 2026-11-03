import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

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
