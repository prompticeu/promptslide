// Shipping PDF renderer: visual fidelity, font subsets/recovery and explicit failures.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, cp } from "node:fs/promises"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"

import sharp from "sharp"

import { captureDeckPdf } from "../../packages/cli/src/utils/export.mjs"
const cliRequire = createRequire(new URL("../../packages/cli/package.json", import.meta.url))
const pdfLib = cliRequire("pdf-lib")
const subsetFont = cliRequire("subset-font")
const repo = resolve(import.meta.dirname, "../..")
const out = join(import.meta.dirname, "results/pdf")
const cwd = await mkdtemp(join(tmpdir(), "promptslide-pdf-"))
const staging = await mkdtemp(join(tmpdir(), "promptslide-pdf-evidence-"))
const original = await readFile("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
const ascii = await subsetFont(
  original,
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join(""),
  { targetFormat: "sfnt" }
)
const greek = await subsetFont(original, "Ω", { targetFormat: "sfnt" })
let permanent = false
const requests = new Map()
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  const count = (requests.get(req.url) || 0) + 1
  requests.set(req.url, count)
  if (permanent || count === 1) {
    res.writeHead(503)
    res.end("Transient font failure")
    return
  }
  if (req.url === "/font.css") {
    await new Promise(done => setTimeout(done, 200))
    res.writeHead(200, { "Content-Type": "text/css" })
    res.end(
      `@font-face{font-family:"Late PDF Font";src:url("http://127.0.0.1:${server.address().port}/ascii.ttf")}`
    )
    return
  }
  res.writeHead(200, { "Content-Type": "font/ttf" })
  res.end(req.url === "/greek.ttf" ? greek : ascii)
})
await new Promise(done => server.listen(0, "127.0.0.1", done))
const origin = `http://127.0.0.1:${server.address().port}`
const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#e11d48" } })
  .png()
  .toBuffer()
const webp = await sharp(png).webp().toBuffer()
const uri = (bytes, type) => `data:image/${type};base64,${bytes.toString("base64")}`
const fixtures = [
  `<h1>PDF AΩ <span style={{marginLeft:100,color:"#f97316"}}>native text</span></h1><div style={{position:"absolute",left:100,top:180,width:450,height:250,borderRadius:40,overflow:"hidden",background:"linear-gradient(120deg,#2563eb,#f97316)"}}><div style={{position:"absolute",left:-20,top:150,width:300,height:160,opacity:.6,background:"#7c3aed",transform:"rotate(20deg)"}}/></div><div style={{position:"absolute",left:650,top:150,width:500,height:350,background:"radial-gradient(ellipse,rgba(249,115,22,.8),transparent 70%)"}}/><svg width="350" height="160" style={{position:"absolute",left:700,top:450}}><defs><filter id="blur"><feGaussianBlur stdDeviation="8"/></filter></defs><rect x="10" y="20" width="80" height="60" style={{width:150}} fill="#2563eb"/><circle cx="240" cy="70" r="40" fill="#f97316" filter="url(#blur)"/></svg>`,
  `<h1>Images and opacity</h1><img src="${uri(png, "png")}" style={{position:"absolute",left:160,top:180,width:200,height:200,transform:"scale(1.5)",objectFit:"none"}}/><img src="${uri(webp, "webp")}" style={{position:"absolute",left:650,top:200,width:250,height:200,objectFit:"contain",opacity:.5}}/><div style={{position:"absolute",left:450,top:500,opacity:.5}}><div style={{position:"absolute",width:200,height:100,background:"#2563eb"}}/><div style={{position:"absolute",left:70,top:30,width:200,height:100,background:"#f97316"}}/></div>`,
  '<h1>Final reveal state</h1><Animated step={2} delay={100}><Animated step={1}><p>Nested reveal Ω</p></Animated></Animated><div id="finite" style={{position:"absolute",top:300,left:100,width:200,height:100,background:"#2563eb",animation:"appear 5s 5s both"}}/><div id="infinite" style={{position:"absolute",top:500,left:100,width:200,height:80,background:"#f97316",animation:"drift 10s infinite"}}/>',
  `<h1>Offscreen lazy asset</h1><img loading="lazy" src="${uri(png, "png")}" style={{position:"absolute",left:100,top:200,width:300,height:300}}/><div style={{display:"none"}}><img src="/unused-missing.png"/><div style={{width:200,height:200,backgroundImage:"url(/unused-background.png)"}}/></div>`,
  '<h1>Transformed chart on a later page</h1><a href="https://example.com/" style={{position:"absolute",top:150,left:900}}>External link</a><div style={{position:"absolute",left:100,top:200,width:700,height:500,overflow:"hidden",border:"2px solid #334155",borderRadius:20}}><div style={{width:850,transform:"scale(.823)",transformOrigin:"top left"}}><div style={{height:280,background:"#dbeafe"}}>Upper panel</div><svg width="850" height="250" viewBox="0 0 300 112" preserveAspectRatio="none"><defs><linearGradient id="later-curve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity=".5"/><stop offset="1" stopColor="#f97316" stopOpacity=".03"/></linearGradient></defs><path d="M0 100C80 100 120 20 300 20L300 112H0Z" fill="url(#later-curve)"/><path d="M0 100C80 100 120 20 300 20" fill="none" stroke="#f97316" strokeWidth="2"/></svg><p>Lower panel remains visible</p></div></div>',
  '<div style={{position:"absolute",inset:0,background:"#0d0d0d",color:"white",padding:60}}><h1 style={{fontSize:52,width:1000,lineHeight:1.1}}>Keep this title <span style={{backgroundImage:"linear-gradient(120deg,#b93a0a,#f97b3d)",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent",boxDecorationBreak:"clone",WebkitBoxDecorationBreak:"clone"}}>bright<br/>and fully visible?</span></h1><div style={{position:"absolute",left:250,top:137,width:180,height:28,background:"#123456",zIndex:10}}/></div>'
]
fixtures.push(
  '<h1>Masked vector dot grid</h1><div style={{position:"absolute",left:120,top:180,width:1000,transform:"scale(.84)",transformOrigin:"top left"}}><svg width="1000" height="500" viewBox="30 20 960 440" style={{overflow:"visible"}}><defs><pattern id="pdf-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#2563eb" fillOpacity=".5"/></pattern><radialGradient id="pdf-dot-fade" r="62%"><stop offset="0" stopColor="white"/><stop offset="48%" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient><mask id="pdf-dot-mask"><rect x="20" y="12" width="1200" height="580" fill="url(#pdf-dot-fade)"/></mask></defs><rect x="20" y="12" width="1200" height="580" fill="url(#pdf-dots)" mask="url(#pdf-dot-mask)"/></svg></div>'
)
const save = slides =>
  writeFile(
    join(cwd, "src/deck-config.tsx"),
    `import React from "react";import {Animated} from "promptslide";export const slides=[${slides.map((jsx, i) => `{id:"pdf-${i}",steps:2,component:()=> <section className="slide">${jsx}</section>}`).join(",")}];`
  )
const run = options =>
  captureDeckPdf({ cwd, browserExecutable: process.env.PPTX_BENCH_CHROMIUM, ...options })
try {
  await mkdir(join(cwd, "src"))
  await mkdir(out, { recursive: true })
  await symlink(join(repo, "node_modules"), join(cwd, "node_modules"), "dir")
  await writeFile(join(cwd, "package.json"), '{"type":"module"}')
  await writeFile(join(cwd, "src/theme.ts"), "export const theme={}")
  await writeFile(
    join(cwd, "src/globals.css"),
    `@font-face{font-family:"PDF Test";src:url("${origin}/ascii.ttf");unicode-range:U+0-7F}@font-face{font-family:"PDF Test";src:url("${origin}/greek.ttf");unicode-range:U+03A9}*{box-sizing:border-box}body{margin:0}.slide{width:1280px;height:720px;background:#f8fafc;font:28px "PDF Test",serif;padding:60px}h1{font-size:40px;font-weight:400;margin:0 0 40px}p{margin:0}@keyframes appear{from{opacity:0;transform:translateX(100px)}to{opacity:1;transform:translateX(0)}}@keyframes drift{from{transform:translateX(0)}to{transform:translateX(200px)}}@media print{h1{display:none}.slide{background:lime}}`
  )
  await save(fixtures)
  const issues = []
  const pdf = await run({
    onIssue: i => issues.push(i),
    onReady: async page => {
      assert.equal(await page.locator("[data-ps-build-step]").count(), 2)
      assert.equal(await page.locator("#finite").evaluate(e => getComputedStyle(e).opacity), "1")
      assert.equal(
        await page.locator("#infinite").evaluate(e => getComputedStyle(e).transform),
        "matrix(1, 0, 0, 1, 0, 0)"
      )
      assert.equal(await page.locator('img[loading="lazy"]').count(), 0)
      for (let i = 0; i < fixtures.length; i++)
        await page
          .locator(".pdf-slide")
          .nth(i)
          .screenshot({ path: join(staging, `source-${i + 1}.png`), scale: "css" })
    }
  })
  await writeFile(join(out, "qualification.pdf"), pdf)
  await cp(staging, out, { recursive: true })
  assert.equal(issues.filter(issue => issue.code === "PDF_GRADIENT_TEXT_GRAPHIC").length, 1)
  assert.equal(requests.get("/ascii.ttf"), 2)
  assert.equal(requests.get("/greek.ttf"), 2)
  assert.ok(issues.some(i => i.code === "FONT_DOWNLOAD_RECOVERED"))
  const tool = process.env.PDF_BENCH_POPPLER || ""
  const env = {
    ...process.env,
    ...(process.env.PDF_BENCH_LIBRARY_PATH
      ? { LD_LIBRARY_PATH: process.env.PDF_BENCH_LIBRARY_PATH }
      : {})
  }
  const info = execFileSync(join(tool, "pdfinfo"), [join(out, "qualification.pdf")], {
    env,
    encoding: "utf8"
  })
  assert.match(info, /Pages:\s+7\b/)
  assert.match(info, /Page size:\s+960 x 540 pts/)
  const text = execFileSync(join(tool, "pdftotext"), [join(out, "qualification.pdf"), "-"], {
    env,
    encoding: "utf8"
  })
  assert.ok(text.includes("PDF AΩ"))
  assert.ok(text.includes("Nested reveal Ω"))
  assert.ok(
    text.includes("and fully visible?"),
    "Gradient paint fallback must keep selectable text"
  )
  const fonts = execFileSync(join(tool, "pdffonts"), [join(out, "qualification.pdf")], {
    env,
    encoding: "utf8"
  })
  assert.match(fonts, /yes\s+yes\s+yes/)
  const merged = await pdfLib.PDFDocument.load(pdf)
  const patternIssues = issues.filter(issue => issue.code === "PDF_PATTERN_EXPANDED")
  assert.equal(patternIssues.length, 1)
  assert.ok(patternIssues[0].dots > 2000)
  assert.equal(
    merged.getPages().at(-1).node.Resources().lookup(pdfLib.PDFName.of("Pattern")),
    undefined,
    "Dot grid must contain vector circles rather than repeating PDF tiles"
  )
  const links = merged.getPages().flatMap(page =>
    (page.node.Annots()?.asArray() || []).map(ref => {
      const annotation = merged.context.lookup(ref)
      const action = annotation.lookup(pdfLib.PDFName.of("A"))
      return action?.lookup(pdfLib.PDFName.of("URI"))?.decodeText()
    })
  )
  assert.ok(
    links.includes("https://example.com/"),
    "External link annotations survive page assembly"
  )
  execFileSync(
    join(tool, "pdftoppm"),
    [
      "-png",
      "-scale-to-x",
      "1280",
      "-scale-to-y",
      "720",
      join(out, "qualification.pdf"),
      join(out, "render")
    ],
    { env }
  )
  const comparisons = []
  for (let i = 1; i <= fixtures.length; i++) {
    const a = await sharp(join(out, `source-${i}.png`))
      .removeAlpha()
      .raw()
      .toBuffer()
    const b = await sharp(join(out, `render-${i}.png`))
      .removeAlpha()
      .raw()
      .toBuffer()
    let sum = 0,
      over16 = 0
    for (let p = 0; p < a.length; p += 3) {
      let max = 0
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a[p + c] - b[p + c])
        sum += d
        max = Math.max(max, d)
      }
      if (max > 16) over16++
    }
    const result = {
      page: i,
      meanAbsoluteRgbError255: sum / a.length,
      pixelsOver16Ratio: over16 / (a.length / 3)
    }
    comparisons.push(result)
    assert.ok(result.meanAbsoluteRgbError255 < 1.5, JSON.stringify(result))
    assert.ok(result.pixelsOver16Ratio < 0.015, JSON.stringify(result))
  }
  const originalCss = await readFile(join(cwd, "src/globals.css"), "utf8")
  await writeFile(
    join(cwd, "src/globals.css"),
    `@import url("${origin}/font.css");body{margin:0;font:40px "Late PDF Font",serif}`
  )
  await save(["<h1>Late stylesheet font</h1>"])
  requests.clear()
  const lateIssues = []
  await run({
    onIssue: issue => lateIssues.push(issue),
    onReady: async page => {
      assert.ok(
        await page.evaluate(() =>
          [...document.fonts].some(
            font => font.family.includes("Late PDF Font") && font.status === "loaded"
          )
        )
      )
    }
  })
  assert.ok(lateIssues.some(issue => issue.code === "STYLESHEET_DOWNLOAD_RECOVERED"))
  assert.ok(lateIssues.some(issue => issue.code === "FONT_DOWNLOAD_RECOVERED"))
  await writeFile(join(cwd, "src/globals.css"), originalCss)
  await save(fixtures)
  permanent = true
  requests.clear()
  await assert.rejects(run(), /font|network/i)
  permanent = false
  await save(['<img src="/missing-image.png"/>'])
  await assert.rejects(run(), /slide image could not be loaded/i)
  await save([
    '<div style={{backgroundImage:"url(/missing-background.png)",width:200,height:200}}/>'
  ])
  await assert.rejects(run(), /background or SVG image could not be loaded/i)
  await save(['{(()=>{throw new Error("Intentional PDF slide failure")})()}'])
  await assert.rejects(run(), /Intentional PDF slide failure/)
  await writeFile(
    join(out, "qualification.json"),
    JSON.stringify(
      {
        passed: true,
        pages: fixtures.length,
        fontSubsetsEmbedded: true,
        externalLinksPreserved: true,
        fontRecovery: true,
        lateStylesheetRecovery: true,
        failuresRejected: [
          "permanent font failure",
          "missing image",
          "missing background image",
          "slide crash"
        ],
        comparisons,
        pdfInfo: info,
        fontInfo: fonts
      },
      null,
      2
    )
  )
  console.log(
    "PDF qualification: seven complex pages, subset fonts, lazy assets, final animations, links, gradient text and four failure cases passed",
    comparisons
  )
} finally {
  await new Promise(done => server.close(done))
  await rm(cwd, { recursive: true, force: true })
  await rm(staging, { recursive: true, force: true })
}
