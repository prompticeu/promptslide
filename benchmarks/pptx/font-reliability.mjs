import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
const repo = resolve(import.meta.dirname, "../.."),
  out = resolve(import.meta.dirname, "results/font-reliability"),
  cwd = await mkdtemp(join(tmpdir(), "promptslide-font-reliability-"))
const bytes = await readFile("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
let cssRequests = 0
let requests = 0,
  permanent = false
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.url === "/font.css") {
    cssRequests++
    if (cssRequests === 1) {
      res.writeHead(503)
      res.end("Transient stylesheet failure")
    } else {
      res.writeHead(200, { "Content-Type": "text/css" })
      res.end(
        `@font-face{font-family:"Reliability Test Face";src:url("http://127.0.0.1:${server.address().port}/font.ttf")}`
      )
    }
    return
  }
  requests++
  if (permanent || requests === 1) {
    res.writeHead(503, { "Content-Type": "text/plain" })
    res.end("Transient font failure")
  } else {
    res.writeHead(200, { "Content-Type": "font/ttf" })
    res.end(bytes)
  }
})
await new Promise(done => server.listen(0, "127.0.0.1", done))
try {
  await mkdir(join(cwd, "src"))
  await mkdir(out, { recursive: true })
  await symlink(join(repo, "node_modules"), join(cwd, "node_modules"), "dir")
  await writeFile(join(cwd, "package.json"), '{"type":"module"}')
  await writeFile(join(cwd, "src/theme.ts"), "export const theme={}")
  await writeFile(
    join(cwd, "src/globals.css"),
    `@font-face{font-family:"Reliability Test Face";src:url("http://127.0.0.1:${server.address().port}/font.ttf")}body{margin:0}.slide{width:1280px;height:720px;background:white;font:40px "Reliability Test Face",sans-serif}`
  )
  await writeFile(
    join(cwd, "src/deck-config.tsx"),
    'import React from "react";export const slides=[{id:"font-retry",steps:0,component:()=> <div className="slide"><p>Recover the original font before measuring.</p></div>}];'
  )
  const runs = []
  for (let i = 0; i < 3; i++) {
    requests = 0
    const result = await exportDeckPptx({ cwd, browserExecutable: process.env.PPTX_BENCH_CHROMIUM })
    assert.ok(result.pptx)
    assert.equal(requests, 2)
    assert.ok(result.report.issues.some(issue => issue.code === "FONT_DOWNLOAD_RECOVERED"))
    assert.equal(
      result.report.issues.some(issue =>
        ["FONT_UNAVAILABLE", "FONT_DOWNLOAD_FAILED"].includes(issue.code)
      ),
      false
    )
    assert.ok(result.report.fonts.length > 0)
    runs.push({ requests, fonts: result.report.fonts, recovered: true })
    await writeFile(join(out, `recovered-${i + 1}.pptx`), result.pptx)
  }
  assert.deepEqual(runs[0].fonts, runs[1].fonts)
  assert.deepEqual(runs[1].fonts, runs[2].fonts)
  requests = 0
  permanent = true
  const failed = await exportDeckPptx({ cwd, browserExecutable: process.env.PPTX_BENCH_CHROMIUM })
  assert.ok(failed.pptx)
  assert.equal(requests, 2)
  assert.ok(failed.report.issues.some(issue => issue.code === "FONT_DOWNLOAD_FAILED"))
  assert.equal(
    failed.report.issues.some(issue => issue.code === "FONT_DOWNLOAD_RECOVERED"),
    false
  )
  requests = 0
  cssRequests = 0
  permanent = false
  await writeFile(
    join(cwd, "src/globals.css"),
    `@import url("http://127.0.0.1:${server.address().port}/font.css");body{margin:0}.slide{width:1280px;height:720px;background:white;font:40px "Reliability Test Face",sans-serif}`
  )
  const stylesheet = await exportDeckPptx({
    cwd,
    browserExecutable: process.env.PPTX_BENCH_CHROMIUM
  })
  assert.ok(stylesheet.pptx)
  assert.ok(cssRequests >= 2 && cssRequests <= 4)
  assert.equal(requests, 2)
  assert.ok(stylesheet.report.issues.some(issue => issue.code === "STYLESHEET_DOWNLOAD_RECOVERED"))
  assert.ok(stylesheet.report.issues.some(issue => issue.code === "FONT_DOWNLOAD_RECOVERED"))
  assert.deepEqual(stylesheet.report.fonts, runs[0].fonts)
  await writeFile(
    join(out, "qualification.json"),
    JSON.stringify(
      {
        passed: true,
        transientRuns: runs,
        permanentFailure: { requests: 2, diagnosed: true },
        stylesheetRecovery: {
          requests: cssRequests,
          fontRequests: requests,
          embeddedOriginalFace: true
        }
      },
      null,
      2
    )
  )
  console.log(
    "Font reliability: three transient failures recovered before layout; permanent failure reported, stylesheet recovery verified."
  )
} finally {
  await new Promise(done => server.close(done))
  await rm(cwd, { recursive: true, force: true })
}
