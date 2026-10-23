import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  DEFAULT_LOOP_CONFIG,
  includedSlides,
  stateDuration,
  loopDuration,
  validateLoopConfig
} from "../src/core/loop/config.mjs"
import { parseDeckConfig, replaceDeckConfig } from "../src/utils/deck-config.mjs"
import { loopConfigMiddleware, readLoopConfig, writeLoopConfig } from "../src/utils/loop-config.mjs"

const config = {
  version: 1,
  defaultDuration: 5,
  slides: {
    agents: { steps: 5, dwell: [3, 2, 2, 2, 3, 12] },
    skip: { excluded: true }
  }
}

test("durations cover the initial state, all steps, and default newly added states", () => {
  const slides = [
    { id: "intro", steps: 0 },
    { id: "agents", steps: 5 },
    { id: "skip", steps: 0 }
  ]
  assert.deepEqual(includedSlides(config, slides), [0, 1])
  assert.equal(loopDuration(config, slides), 29)
  assert.equal(stateDuration(config, slides[1], 1, 5), 12)
  assert.equal(stateDuration(config, slides[1], 1, 6), 5)
  const inherited = validateLoopConfig({
    ...config,
    defaultDuration: 9,
    slides: { agents: { dwell: [null, 2] } }
  })
  assert.equal(stateDuration(inherited, slides[1], 1, 0), 9)
  assert.equal(stateDuration(inherited, slides[1], 1, 1), 2)
  assert.equal(loopDuration(config, [slides[1], slides[0]]), 29)
  assert.equal(loopDuration({ ...config, slides: { intro: { excluded: true } } }, [slides[0]]), 0)
})

test("invalid and oversized settings fail closed", () => {
  for (const duration of [0, -1, NaN, Infinity, 3601, "5"]) {
    assert.throws(() => validateLoopConfig({ ...config, defaultDuration: duration }))
    assert.throws(() => validateLoopConfig({ ...config, slides: { a: { dwell: [duration] } } }))
  }
  for (const slides of [
    [],
    null,
    { a: { excluded: "yes" } },
    { a: { steps: 0.5 } },
    { a: { dwell: Array(1002).fill(1) } }
  ]) {
    assert.throws(() => validateLoopConfig({ ...config, slides }))
  }
  assert.doesNotThrow(() => validateLoopConfig(DEFAULT_LOOP_CONFIG))
})

test("publishing and reconstructing a deck preserves loop settings and stable IDs", () => {
  const root = mkdtempSync(join(tmpdir(), "promptslide-loop-"))
  try {
    mkdirSync(join(root, "src"))
    replaceDeckConfig(
      root,
      [{ id: "agents", componentName: "Agents", importPath: "@/slides/agents", steps: 5 }],
      { loopConfig: config }
    )
    const published = parseDeckConfig(root)
    assert.deepEqual(JSON.parse(JSON.stringify(published.loopConfig)), config)
    assert.equal(published.slides[0].id, "agents")
    replaceDeckConfig(root, [
      { id: "agents", componentName: "Agents", importPath: "@/slides/agents", steps: 5 }
    ])
    assert.deepEqual(JSON.parse(JSON.stringify(readLoopConfig(root))), DEFAULT_LOOP_CONFIG)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("Studio persists validated settings and rejects cross-origin writes", async () => {
  const root = mkdtempSync(join(tmpdir(), "promptslide-loop-http-"))
  const middleware = loopConfigMiddleware(root)
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  )
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    const post = (body, from = origin) =>
      fetch(`${origin}/__promptslide_loop`, {
        method: "POST",
        headers: { Origin: from, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
    assert.equal((await post(config)).status, 204)
    assert.deepEqual(JSON.parse(readFileSync(join(root, "loop-config.json"), "utf8")), config)
    assert.equal((await post(config, "https://other.example")).status, 403)
    assert.equal((await post({ ...config, defaultDuration: 0 })).status, 400)
    assert.equal((await fetch(`${origin}/__promptslide_loop`)).status, 405)
    assert.deepEqual(JSON.parse(readFileSync(join(root, "loop-config.json"), "utf8")), config)
  } finally {
    await new Promise(resolve => server.close(resolve))
    rmSync(root, { recursive: true, force: true })
  }
})

test("saving never follows a loop configuration symlink", () => {
  const root = mkdtempSync(join(tmpdir(), "promptslide-loop-link-"))
  try {
    const destination = join(root, "other.json")
    writeFileSync(destination, "original")
    symlinkSync(destination, join(root, "loop-config.json"))
    assert.throws(() => writeLoopConfig(root, config))
    assert.equal(readFileSync(destination, "utf8"), "original")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
