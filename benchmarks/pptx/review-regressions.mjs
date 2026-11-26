// Real DOM -> captured assets -> PPTX regressions from the feature review.
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"

import JSZip from "jszip"
import sharp from "sharp"

import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
const repo = resolve(import.meta.dirname, "../..")
const out = join(import.meta.dirname, "results/review")
const cwd = await mkdtemp(join(tmpdir(), "promptslide-review-"))
const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: "red" } })
  .png()
  .toBuffer()
const webp = await sharp(png).webp().toBuffer()
const image = (bytes, type) => `data:image/${type};base64,${bytes.toString("base64")}`
const chart = JSON.stringify({
  type: "column",
  series: [{ name: "Revenue", labels: ["A", "B"], values: [4, 7] }]
})
const cases = [
  {
    id: "inline-margin",
    jsx: '<p style={{position:"absolute",left:50,top:50}}><span>Left</span><span style={{marginLeft:100}}>Right</span></p>'
  },
  {
    id: "nested-opacity",
    jsx: '<div style={{position:"absolute",left:100,top:100,opacity:.5}}><div><div style={{position:"absolute",width:150,height:150,background:"red"}}/><div style={{position:"absolute",left:50,top:50,width:150,height:150,background:"blue"}}/></div></div>'
  },
  {
    id: "webp-opacity",
    jsx: `<img src="${image(webp, "webp")}" style={{position:"absolute",left:100,top:100,width:100,height:100,opacity:.5}}/>`
  },
  ...["none", "scale-down"].map(fit => ({
    id: `scaled-${fit}`,
    jsx: `<img src="${image(png, "png")}" style={{position:"absolute",left:200,top:200,width:200,height:200,transform:"scale(2)",objectFit:"${fit}"}}/>`
  })),
  ...["X", "Y"].map(axis => ({
    id: `reflect-${axis}`,
    jsx: `<div style={{position:"absolute",left:100,top:100,width:200,height:100,transform:"scale${axis}(-1)",background:"linear-gradient(90deg,red,blue)"}}/>`
  })),
  {
    id: "svg-css-geometry",
    jsx: '<svg width="400" height="200"><rect x="20" y="20" width="100" height="100" style={{width:200}} fill="red"/><path d="M0 0h10v10Z" style={{d:"path(\'M250 20h30v30Z\')"}} fill="blue"/></svg>'
  },
  {
    id: "hidden-pattern",
    jsx: '<svg width="960" height="480"><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="red" visibility="hidden"/></pattern><radialGradient id="fade" r="70%"><stop offset="0" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient><mask id="mask"><rect width="960" height="480" fill="url(#fade)"/></mask></defs><rect width="960" height="480" fill="url(#dots)" mask="url(#mask)"/></svg>'
  },
  {
    id: "rowspan",
    jsx: '<table style={{width:200,height:80,tableLayout:"fixed",borderCollapse:"collapse"}}><tbody><tr style={{height:40}}><td rowSpan={2}>A</td><td>B</td></tr><tr style={{height:40}}><td>C</td></tr></tbody></table>'
  },
  {
    id: "translucent-table",
    jsx: "<div style={{opacity:.2}}><table><tbody><tr><td>Table</td></tr></tbody></table></div>"
  },
  {
    id: "translucent-chart",
    jsx: `<div style={{opacity:.2}}><div style={{width:400,height:300,background:"red"}} data-pptx-chart={${JSON.stringify(chart)}}/></div>`
  },
  {
    id: "clipped-adapter",
    jsx: '<div style={{position:"absolute",left:100,top:100,width:100,height:100,overflow:"hidden"}}><Canvas/></div>'
  },
  {
    id: "alpha-stops",
    jsx: `<div style={{width:400,height:300,background:"linear-gradient(90deg,${Array.from({ length: 9 }, (_, i) => `rgba(255,0,0,${1 - i / 8}) ${i * 12.5}%`).join(",")})"}}/>`
  },
  {
    id: "nested-reveal",
    steps: 2,
    jsx: "<Animated step={2}><Animated step={1}><p>Nested reveal</p></Animated></Animated>"
  }
]
try {
  await mkdir(join(cwd, "src"))
  await mkdir(out, { recursive: true })
  await symlink(join(repo, "node_modules"), join(cwd, "node_modules"), "dir")
  await writeFile(join(cwd, "package.json"), '{"type":"module"}')
  await writeFile(join(cwd, "src/theme.ts"), "export const theme={}")
  await writeFile(
    join(cwd, "src/globals.css"),
    '*{box-sizing:border-box}body{margin:0}p{margin:0;font-size:24px;line-height:1.5}td{padding:0;font-size:20px}.slide{position:relative;width:1280px;height:720px;background:white;overflow:hidden;font-family:"DejaVu Sans"}'
  )
  await writeFile(
    join(cwd, "src/deck-config.tsx"),
    `import React,{useRef,useLayoutEffect} from "react";import {Animated,registerPptxExportAdapter} from "promptslide";
  registerPptxExportAdapter({id:"review-canvas",match:e=>e.tagName==="CANVAS",toScene:(e,c)=>[{id:"canvas-gradient",kind:"shape",box:c.box,payload:{fill:{kind:"linear",angle:90,stops:[{position:0,color:{hex:"FF0000",alpha:1}},{position:1,color:{hex:"0000FF",alpha:1}}]}}}]});
  function Canvas(){const ref=useRef(null);useLayoutEffect(()=>{const c=ref.current.getContext("2d"),g=c.createLinearGradient(0,0,200,0);g.addColorStop(0,"red");g.addColorStop(1,"blue");c.fillStyle=g;c.fillRect(0,0,200,100)},[]);return <canvas width={200} height={100} ref={ref}/>}
  export const slides=[${cases.map(c => `{id:"${c.id}",steps:${c.steps || 0},component:()=> <div className="slide">${c.jsx}</div>}`).join(",")}];`
  )
  const frames = []
  const result = await exportDeckPptx({
    cwd,
    buildMode: "slides",
    browserExecutable: process.env.PPTX_BENCH_CHROMIUM,
    onFrame: async (frame, page) => {
      frames.push(frame)
      if (frame.step === 0)
        await page
          .locator("[data-ps-pptx-root]")
          .screenshot({ path: join(out, `${frame.slideId}-source.png`), scale: "css" })
    }
  })
  await writeFile(join(out, "regressions.pptx"), result.pptx)
  await writeFile(join(out, "report.json"), JSON.stringify(result.report, null, 2))
  const frame = (id, step = 0) => frames.find(f => f.slideId === id && f.step === step)
  const content = id =>
    frame(id).nodes.filter(n => n.kind !== "shape" || n.payload.fill?.hex !== "FFFFFF")
  const text = frame("inline-margin").nodes.find(n => n.kind === "text")
  assert.equal(text.payload.lines.length, 2)
  assert.ok(text.payload.lines[1].x - text.payload.lines[0].x > 100)
  for (const id of [
    "nested-opacity",
    "translucent-table",
    "translucent-chart",
    "clipped-adapter"
  ]) {
    const captures = frame(id).nodes.filter(n => n.kind === "fallback")
    assert.equal(captures.length, 1, id)
    assert.equal(captures[0].payload.scope, "subtree", id)
    assert.equal(captures[0].opacity, 1, id)
    const decoded = await sharp(
      Buffer.from(captures[0].payload.data.split(",")[1], "base64")
    ).stats()
    assert.ok(decoded.channels[3].max > 0, id)
  }
  const normalized = frame("webp-opacity").nodes.find(n => n.kind === "fallback")
  assert.equal(normalized.opacity, 1)
  const stats = await sharp(Buffer.from(normalized.payload.data.split(",")[1], "base64")).stats()
  assert.ok(stats.channels[3].mean >= 126 && stats.channels[3].mean <= 129)
  for (const [id, rotate] of [
    ["reflect-X", 0],
    ["reflect-Y", 180]
  ]) {
    const shape = frame(id).nodes.find(n => n.kind === "shape" && n.payload.fill?.kind === "linear")
    assert.ok(Math.abs(Math.abs(shape.payload.rotate) - rotate) < 0.001, id)
    assert.equal(shape.payload.flipH, true, id)
  }
  const paths = frame("svg-css-geometry")
    .nodes.filter(n => n.kind === "paths")
    .flatMap(n => n.payload.paths)
  assert.ok(paths.some(p => p.d.includes("h200")))
  assert.ok(paths.some(p => p.d.includes("250")))
  assert.ok(
    !content("hidden-pattern").some(n => n.id.includes(":pattern:") || n.kind === "fallback")
  )
  assert.deepEqual(
    frame("rowspan").nodes.find(n => n.kind === "table").payload.rowHeights,
    [40, 40]
  )
  assert.ok(!JSON.stringify(frame("nested-reveal", 1)).includes('"text":"Nested reveal"'))
  assert.equal(frame("nested-reveal", 2).nodes.find(n => n.kind === "text").buildStep, 2)
  assert.equal(
    frame("alpha-stops").nodes.some(n => n.kind === "fallback"),
    false
  )
  const zip = await JSZip.loadAsync(result.pptx)
  for (const id of ["scaled-none", "scaled-scale-down"]) {
    const index = frames.findIndex(f => f.slideId === id) + 1
    const xml = await zip.file(`ppt/slides/slide${index}.xml`).async("string")
    assert.match(xml, /<a:ext cx="1905000" cy="1905000"/)
  }
  await writeFile(
    join(out, "checks.json"),
    JSON.stringify({ fixtures: cases.length, frames: frames.length, passed: true }, null, 2)
  )
  console.log(`Review regressions: ${cases.length} fixtures, ${frames.length} states passed`)
} finally {
  await rm(cwd, { recursive: true, force: true })
}
