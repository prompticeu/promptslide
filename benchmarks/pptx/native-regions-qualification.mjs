// Generic clip, opacity and masked-pattern fixtures. No registry deck IDs or colors.
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"

import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
const repo = resolve(import.meta.dirname, "../.."),
  out = resolve(import.meta.dirname, "results/native-regions"),
  cwd = await mkdtemp(join(tmpdir(), "promptslide-native-regions-"))
const pattern = (
  id,
  {
    step = 24,
    r = 1,
    offset = 0,
    stops = '<stop offset="0" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/>'
  } = {}
) =>
  `<svg width="960" height="480" viewBox="0 0 960 480" style={{position:"absolute",left:160,top:200}}><defs><pattern id="${id}-dots" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="#2563eb" fillOpacity=".35"/></pattern><radialGradient id="${id}-fade" r="70%">${stops}</radialGradient><mask id="${id}-mask"><rect width="960" height="480" fill="url(#${id}-fade)"/></mask></defs><rect x="${offset}" width="${960 - offset}" height="480" fill="url(#${id}-dots)" mask="url(#${id}-mask)"/></svg>`
const cases = [
  {
    id: "rect-clip",
    jsx: '<div style={{position:"absolute",left:140,top:200,width:500,height:300,overflow:"hidden"}}><div style={{position:"absolute",left:-30,top:30,width:590,height:200,background:"#2563eb"}}/><p style={{position:"absolute",left:20,top:30}}>EDITABLE INSIDE</p><p style={{position:"absolute",left:510,top:30}}>OUTSIDE HIDDEN</p></div>'
  },
  {
    id: "rounded-clip",
    jsx: '<div style={{position:"absolute",left:160,top:210,width:500,height:300,borderRadius:32,overflow:"hidden",border:"4px solid #0f172a"}}><div style={{position:"absolute",inset:-20,background:"#7c3aed"}}/><p style={{position:"absolute",left:40,top:40}}>ROUNDED INTERIOR</p></div>'
  },
  {
    id: "nested-scaled",
    jsx: '<div style={{position:"absolute",left:180,top:200,width:500,height:300,borderRadius:28,overflow:"hidden"}}><div style={{position:"absolute",width:800,height:500,transform:"scale(.8)",transformOrigin:"top left"}}><div style={{position:"absolute",left:-40,top:30,width:650,height:290,overflow:"hidden",borderRadius:24}}><div style={{position:"absolute",inset:-20,background:"linear-gradient(90deg,#2563eb,#e11d48)"}}/><p style={{position:"absolute",left:100,top:50}}>NESTED INTERIOR</p></div></div></div>'
  },
  {
    id: "single-paint-opacity",
    jsx: '<div style={{position:"absolute",left:150,top:250,width:600,height:240,transform:"scale(.87)",transformOrigin:"center",opacity:.42}}><div style={{width:600,height:200,borderRadius:40,background:"#2563eb",border:"2px solid #334155"}}><span style={{visibility:"hidden"}}>HIDDEN CARD CONTENT</span></div></div>'
  },
  {
    id: "overlapping-opacity-fallback",
    jsx: '<div style={{position:"absolute",left:150,top:250,width:600,height:240,transform:"scale(.87)",opacity:.42}}><div style={{position:"absolute",width:300,height:200,background:"#2563eb"}}/><div style={{position:"absolute",left:150,width:300,height:200,background:"#e11d48"}}/></div>'
  },
  { id: "native-pattern", jsx: pattern("native") },
  {
    id: "steep-mask-fallback",
    jsx: pattern("steep", {
      stops:
        '<stop offset="0" stopColor="white"/><stop offset=".499" stopColor="white"/><stop offset=".5" stopColor="white" stopOpacity="0"/><stop offset="1" stopColor="white" stopOpacity="0"/>'
    })
  },
  { id: "partial-dot-fallback", jsx: pattern("partial", { offset: 12 }) },
  { id: "dense-pattern-fallback", jsx: pattern("dense", { step: 4, r: 0.3 }) }
]
try {
  await mkdir(join(cwd, "src"))
  await mkdir(out, { recursive: true })
  await symlink(join(repo, "node_modules"), join(cwd, "node_modules"), "dir")
  await writeFile(join(cwd, "package.json"), '{"type":"module"}')
  await writeFile(join(cwd, "src/theme.ts"), "export const theme={}")
  await writeFile(
    join(cwd, "src/globals.css"),
    'body{margin:0}*{box-sizing:border-box}.slide{position:relative;width:1280px;height:720px;background:#f8fafc;overflow:hidden;font-family:"DejaVu Sans"}p{margin:0;font-size:24px;white-space:nowrap}'
  )
  await writeFile(
    join(cwd, "src/deck-config.tsx"),
    `import React from "react";export const slides=[${cases.map(c => `{id:"${c.id}",steps:0,component:()=> <div className="slide">${c.jsx}</div>}`).join(",")}];`
  )
  const scenes = []
  const result = await exportDeckPptx({
    cwd,
    browserExecutable: process.env.PPTX_BENCH_CHROMIUM,
    onFrame: async (frame, page) => {
      scenes.push(frame)
      await page
        .locator("[data-ps-pptx-root]")
        .screenshot({ path: join(out, `${frame.slideId}-source.png`), scale: "css" })
    }
  })
  assert.ok(result.pptx)
  await writeFile(join(out, "native-regions.pptx"), result.pptx)
  await writeFile(join(out, "report.json"), JSON.stringify(result.report, null, 2))
  await writeFile(join(out, "scenes.json"), JSON.stringify(scenes, null, 2))
  const scene = id => scenes.find(s => s.slideId === id)
  for (const id of ["rect-clip", "rounded-clip", "single-paint-opacity"])
    assert.equal(
      scene(id).nodes.some(n => ["picture", "fallback"].includes(n.kind)),
      false,
      id
    )
  assert.ok(
    scene("rect-clip").nodes.some(
      n => n.kind === "text" && JSON.stringify(n.payload).includes("EDITABLE INSIDE")
    )
  )
  assert.equal(
    scene("rect-clip").nodes.some(n => JSON.stringify(n.payload).includes("OUTSIDE HIDDEN")),
    false
  )
  assert.ok(
    scene("nested-scaled").nodes.some(
      n => n.kind === "text" && JSON.stringify(n.payload).includes("NESTED INTERIOR")
    )
  )
  assert.ok(
    scene("overlapping-opacity-fallback").nodes.some(n => ["picture", "fallback"].includes(n.kind))
  )
  assert.ok(scene("native-pattern").nodes.filter(n => n.id.includes(":pattern:")).length > 500)
  assert.equal(
    scene("native-pattern").nodes.some(n => ["picture", "fallback"].includes(n.kind)),
    false
  )
  for (const id of ["steep-mask-fallback", "partial-dot-fallback", "dense-pattern-fallback"])
    assert.ok(
      scene(id).nodes.some(n => ["picture", "fallback"].includes(n.kind)),
      id
    )
  console.log(`Native regions: ${cases.length} generic fixtures passed`)
} finally {
  await rm(cwd, { recursive: true, force: true })
}
