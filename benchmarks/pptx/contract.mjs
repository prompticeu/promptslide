// Export contract integration checks: real React states, native adapters and strict decisions.
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"

import JSZip from "jszip"

import { getCaptureServer } from "../../packages/cli/src/utils/export.mjs"
import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
const repo = resolve(import.meta.dirname, "../.."),
  out = join(import.meta.dirname, "results/production")
const cwd = await mkdtemp(join(tmpdir(), "promptslide-pptx-contract-"))
const browserExecutable = process.env.PPTX_BENCH_CHROMIUM
const checks = []
try {
  await mkdir(join(cwd, "src"))
  await mkdir(out, { recursive: true })
  await symlink(join(repo, "node_modules"), join(cwd, "node_modules"), "dir")
  await writeFile(join(cwd, "package.json"), '{"type":"module"}')
  await writeFile(join(cwd, "src/theme.ts"), "export const theme = {}")
  await writeFile(
    join(cwd, "src/globals.css"),
    '*{box-sizing:border-box}body{margin:0;font-family:"DejaVu Sans"} .slide{width:1280px;height:720px;background:white;padding:50px}p{margin:0;font-size:24px;line-height:1.5}td{padding:8px 12px;border:2px solid #2563eb}table{border-collapse:collapse;width:400px;table-layout:fixed;font-size:20px}'
  )
  const save = jsx =>
    writeFile(
      join(cwd, "src/deck-config.tsx"),
      `import React from "react"; import { Animated } from "promptslide"; export const slides = [{id:"contract", steps:1, notes:"Contract note", component:()=> <div className="slide">${jsx}</div>}]`
    )
  const run = options => exportDeckPptx({ cwd, browserExecutable, ...options })
  await save("<p>Always visible</p><Animated step={1}><p>Revealed text</p></Animated>")
  for (const buildMode of ["final", "slides", "native"]) {
    const result = await run({ mode: "strict", buildMode })
    assert.ok(result.pptx, JSON.stringify(result.report.issues))
    const zip = await JSZip.loadAsync(result.pptx)
    assert.equal(
      Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length,
      buildMode === "slides" ? 2 : 1
    )
    const first = await zip.file("ppt/slides/slide1.xml").async("string")
    assert.match(first, /Always visible/)
    if (buildMode === "slides") {
      assert.doesNotMatch(first, /Revealed text/)
      assert.match(await zip.file("ppt/slides/slide2.xml").async("string"), /Revealed text/)
    } else assert.match(first, /Revealed text/)
    if (buildMode === "native") assert.match(first, /<p:timing>/)
    await writeFile(join(out, `contract-${buildMode}.pptx`), result.pptx)
    checks.push(`strict-${buildMode}`)
  }
  await save('<div style={{width:400,height:240,background:"conic-gradient(red, blue)"}}/>')
  const rejected = await run({ mode: "strict" })
  assert.equal(rejected.report.status, "rejected")
  assert.equal(rejected.pptx, undefined)
  const balanced = await run({})
  assert.ok(balanced.pptx)
  assert.equal(balanced.report.metrics.rasterFallbackObjects, 1)
  await writeFile(
    join(out, "contract-rejected.report.json"),
    JSON.stringify(rejected.report, null, 2)
  )
  checks.push("strict-rejects-fallback", "balanced-preserves-fallback")
  await save(
    '<div style={{width:400,height:240,background:"linear-gradient(90deg,red,rgba(0,0,255,.4))"}}/>'
  )
  assert.equal((await run({ mode: "strict" })).report.status, "rejected")
  assert.ok((await run({ mode: "strict", profile: "extended" })).pptx)
  checks.push("extended-explicit-alpha-allowlist")
  await save(
    '<table><tbody><tr><td>Editable A</td><td>Editable B</td></tr><tr><td colSpan={2}>Merged cell</td></tr></tbody></table><div style={{position:"absolute",left:550,top:100,width:600,height:400}} data-pptx-chart={JSON.stringify({type:"column",series:[{name:"Revenue",labels:["A","B"],values:[4,7]}]})}/>'
  )
  const semantic = await run({
    mode: "strict",
    onFrame: async (frame, page) => {
      await page
        .locator("[data-ps-pptx-root]")
        .screenshot({ path: join(out, "contract-semantic-reference.png"), scale: "css" })
    }
  })
  assert.ok(semantic.pptx, JSON.stringify(semantic.report.issues))
  assert.equal(semantic.report.metrics.semanticTablesRetained, 1)
  assert.equal(semantic.report.metrics.semanticChartsRetained, 1)
  await writeFile(join(out, "contract-semantic.pptx"), semantic.pptx)
  checks.push("native-chart-workbook", "native-table-merged-cell")
  await save(
    '<p>Visible<span style={{visibility:"hidden"}}>HIDDEN-CONTENT</span></p><div style={{position:"absolute",left:100,top:200,width:200,height:100,background:"#2563eb",boxShadow:"20px 20px 10px #000"}}/><p style={{position:"absolute",left:500,top:200,width:100,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Clipped text must stay clipped</p><div style={{position:"absolute",left:100,top:450,width:400,height:100,backgroundColor:"#16a34a",backgroundImage:"linear-gradient(90deg,rgba(255,0,0,.4),rgba(0,0,255,.4))"}}/>'
  )
  const complex = await run({})
  const complexZip = await JSZip.loadAsync(complex.pptx)
  const complexXml = await complexZip.file("ppt/slides/slide1.xml").async("string")
  assert.doesNotMatch(complexXml, /HIDDEN-CONTENT/)
  assert.doesNotMatch(complexXml, /Clipped text must stay clipped/)
  const shadow = complex.report.slides[0].fallbackObjects.find(
    o => o.reason === "UNSUPPORTED_PAINT"
  )
  assert.ok(shadow.box.width > 200 && shadow.box.height > 100)
  assert.ok(
    complex.report.slides[0].fallbackObjects.some(o => o.reason === "COMPLEX_COMPOSITION_FALLBACK")
  )
  assert.match(complexXml, /16A34A/)
  await writeFile(join(out, "contract-composites.pptx"), complex.pptx)
  checks.push(
    "hidden-inline-excluded",
    "shadow-painted-extent",
    "text-clipping-preserved",
    "gradient-underlying-fill-preserved"
  )
  await save(
    '<div style={{position:"absolute",inset:0,overflow:"hidden",background:"white"}}><p style={{position:"absolute",left:40,top:40}}>Editable canvas text</p><div style={{position:"absolute",left:1200,top:640,width:240,height:160,background:"#2563eb"}}/></div>'
  )
  const canvasClip = await run({ mode: "strict" })
  assert.ok(canvasClip.pptx, JSON.stringify(canvasClip.report.issues))
  assert.equal(canvasClip.report.metrics.rasterFallbackObjects, 0)
  assert.equal(canvasClip.report.metrics.editableTextCharacters, "Editable canvas text".length)
  await writeFile(join(out, "contract-canvas-clip.pptx"), canvasClip.pptx)
  checks.push("full-slide-clip-retains-native-content")
  await save(
    '<div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:40,background:"white"}}><p style={{position:"absolute",left:40,top:40}}>Rounded clipping</p><div style={{position:"absolute",left:1200,top:640,width:240,height:160,background:"#2563eb"}}/></div>'
  )
  const roundedClip = await run({})
  assert.equal(roundedClip.report.metrics.rasterFallbackObjects, 0)
  assert.equal(roundedClip.report.metrics.editableTextCharacters, "Rounded clipping".length)
  checks.push("rounded-canvas-solid-intersection-retains-native-content")
  await mkdir(join(cwd, "public"))
  await writeFile(
    join(cwd, "public/tiny.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="3" fill="blue"/></svg>'
  )
  await save(
    '<img src="/missing-hidden.png" style={{display:"none"}}/><img loading="lazy" src="/tiny.svg" style={{width:320,height:160}}/>'
  )
  const svgImage = await run({})
  const svgZip = await JSZip.loadAsync(svgImage.pptx)
  const pngs = Object.keys(svgZip.files).filter(name => /^ppt\/media\/.*\.png$/.test(name))
  assert.ok(pngs.length)
  const png = await svgZip.file(pngs[0]).async("nodebuffer")
  assert.ok(
    png.readUInt32BE(16) >= 640 && png.readUInt32BE(20) >= 640,
    "SVG compatibility PNG must match displayed size at raster scale"
  )
  checks.push("hidden-broken-image-ignored", "lazy-svg-image-ready", "svg-compatibility-resolution")
  await save('<img src="/missing-visible.png"/>')
  await assert.rejects(run({}), error => {
    assert.match(error.message, /ASSET_UNAVAILABLE: A slide image could not be loaded/)
    assert.equal(error.report.status, "failed")
    return true
  })
  checks.push("missing-image-actionable-error")
  const stalled = createServer((req, res) => res.end("<html><body>Loading</body></html>"))
  await new Promise(done => stalled.listen(0, "127.0.0.1", done))
  try {
    await assert.rejects(
      run({ baseUrl: `http://127.0.0.1:${stalled.address().port}`, timeout: 1 }),
      error => {
        assert.equal(error.report.status, "failed")
        assert.equal(error.report.issues.at(-1).code, "EXPORT_TIMEOUT")
        assert.match(error.message, /--timeout/)
        return true
      }
    )
  } finally {
    await new Promise(done => stalled.close(done))
  }
  checks.push("timeout-reported-as-failure")
  const captures = await Promise.all([getCaptureServer(cwd), getCaptureServer(cwd)])
  assert.notEqual(captures[0].baseUrl, captures[1].baseUrl)
  await Promise.all(captures.map(server => server.close()))
  checks.push("concurrent-capture-ports")
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(run({ signal: controller.signal }), error => {
    assert.equal(error.report.status, "cancelled")
    assert.equal(error.report.issues.at(-1).code, "CANCELLED")
    return true
  })
  checks.push("abort-before-launch")
  await writeFile(
    join(out, "contract-qa.json"),
    JSON.stringify({ passed: true, checks }, null, 2) + "\n"
  )
  console.log("Contract checks passed:", checks.join(", "))
} finally {
  await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
