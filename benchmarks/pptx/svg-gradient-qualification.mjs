import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
const repo = resolve(import.meta.dirname, "../.."),
  out = resolve(import.meta.dirname, "results/svg-gradients"),
  cwd = await mkdtemp(join(tmpdir(), "promptslide-svg-gradients-"))
const cases = [
  { id: "small-stroke-fallback", stroke: true, height: 350, fallback: true },
  { id: "large-stroke-fallback", stroke: true, height: 100, fallback: true },
  { id: "sharp-stroke-fallback", stroke: true, sharp: true, height: 350, fallback: true },
  { id: "vertical-alpha", attrs: 'x1="0" x2="0" y1="0" y2="1"', alpha: 0.05 },
  {
    id: "multicolor-fallback",
    fallback: true,
    attrs: 'x1="0" x2="1" y1="0" y2="0"',
    alpha: 1,
    color: "#7c3aed"
  },
  { id: "horizontal-alpha", attrs: 'x1="0" x2="1" y1="0" y2="0"', alpha: 0.1 },
  { id: "reverse-vertical", attrs: 'x1="0" x2="0" y1="1" y2="0"', alpha: 0.3 },
  { id: "diagonal-fallback", attrs: 'x1="0" x2="1" y1="0" y2="1"', fallback: true },
  {
    id: "transformed-fallback",
    attrs: 'gradientTransform="rotate(25)" x1="0" x2="0" y1="0" y2="1"',
    fallback: true
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
    "body{margin:0}.slide{width:1280px;height:720px;position:relative;background:#f1f5f9}"
  )
  await writeFile(
    join(cwd, "src/deck-config.tsx"),
    `import React from "react";export const slides=[${cases.map(c => `{id:"${c.id}",steps:0,component:()=> <div className="slide"><div data-pptx-group data-pptx-name="Editable illustration" style={{position:"absolute",left:200,top:200}}><div style={{position:"absolute",width:800,height:${c.height || 300},background:"#fff"}}/><svg width="800" height="${c.height || 300}" viewBox="0 0 400 180" preserveAspectRatio="none" style={{position:"relative",overflow:${c.stroke ? '"visible"' : '"hidden"'}}}><defs><linearGradient id="g" ${c.attrs}><stop offset="0" stopColor="#2563eb" stopOpacity="${c.alpha === 1 ? 1 : 0.8}"/><stop offset="1" stopColor="${c.color || "#2563eb"}" stopOpacity="${c.alpha ?? 0}"/></linearGradient></defs>${c.stroke ? `<path d="${c.sharp ? "M0 170L200 10L400 170" : "M0 170C70 170 70 90 160 90C240 90 240 10 400 10"}" fill="none" stroke="#2563eb" strokeWidth="1.4"/>` : `<path d="M0 170C80 150 100 170 160 85C220 25 290 50 400 10L400 180L0 180Z" fill="url(#g)"/>`}</svg></div></div>}`).join(",")}];`
  )
  const scenes = []
  const result = await exportDeckPptx({
    cwd,
    browserExecutable: process.env.PPTX_BENCH_CHROMIUM,
    onFrame: async (frame, page) => {
      scenes.push(frame)
      await page
        .locator("[data-ps-pptx-root]")
        .screenshot({ path: join(out, frame.slideId + "-source.png"), scale: "css" })
    }
  })
  await writeFile(join(out, "svg-gradients.pptx"), result.pptx)
  await writeFile(join(out, "report.json"), JSON.stringify(result.report, null, 2))
  await writeFile(join(out, "scenes.json"), JSON.stringify(scenes, null, 2))
  for (const c of cases) {
    const frame = scenes.find(f => f.slideId === c.id)
    if (c.fallback)
      assert.ok(
        frame.nodes.some(n => n.kind === "fallback"),
        c.id
      )
    else {
      assert.equal(
        frame.nodes.some(n => n.kind === "fallback"),
        false,
        c.id
      )
      assert.ok(
        frame.nodes.some(
          n =>
            n.kind === "paths" &&
            (c.stroke ? !!n.payload.paths[0].stroke : n.payload.paths[0].fill?.kind === "linear")
        ),
        c.id
      )
      assert.ok(
        frame.nodes.filter(n => n.componentGroups?.some(g => g.name === "Editable illustration"))
          .length >= 2
      )
    }
  }
  console.log("SVG paint: three native cases and six conservative fallbacks passed.")
} finally {
  await rm(cwd, { recursive: true, force: true })
}
