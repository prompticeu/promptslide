// Run from the repository root after building the SDK. Uses local Chromium and fonts.
import assert from "node:assert/strict"
import { writeFile, mkdir, mkdtemp, symlink, cp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve, join } from "node:path"

import { exportDeckPptx } from "../../packages/cli/src/utils/pptx/export.mjs"
import { createViteConfig } from "../../packages/cli/src/vite/config.mjs"
const root = resolve("."),
  out = resolve(process.env.PROMPTSLIDE_BROWSER_REPORT_DIR || "artifacts/browser-qualification/sdk")
const require = createRequire(resolve("packages/cli/package.json"))
const { createServer } = require("vite"),
  { chromium, firefox, webkit } = require("playwright"),
  JSZip = require("jszip")
await mkdir(out, { recursive: true })
const tmp = await mkdtemp("/tmp/promptslide-browser-project-")
let server, browser
try {
  await mkdir(join(tmp, "src"))
  await mkdir(join(tmp, "public/fonts"), { recursive: true })
  await symlink(resolve("node_modules"), join(tmp, "node_modules"), "dir")
  await writeFile(
    join(tmp, "public/parent-fixture.html"),
    "<html><body>Parent fixture</body></html>"
  )
  await writeFile(join(tmp, "package.json"), '{"type":"module"}')
  const fontFiles = {
    regular: "DejaVuSansMono.ttf",
    bold: "DejaVuSansMono-Bold.ttf",
    italic: "DejaVuSansMono-Oblique.ttf",
    boldItalic: "DejaVuSansMono-BoldOblique.ttf"
  }
  for (const [key, file] of Object.entries(fontFiles))
    await cp(
      join(process.env.PROMPTSLIDE_TEST_FONT_DIR || "/usr/share/fonts/truetype/dejavu", file),
      join(tmp, "public/fonts", key + ".ttf")
    )
  await writeFile(
    join(tmp, "src/theme.ts"),
    'export const theme={fonts:{body:"DejaVu Sans Mono",heading:"DejaVu Sans Mono"}}'
  )
  await writeFile(
    join(tmp, "src/globals.css"),
    Object.entries(fontFiles)
      .map(
        ([key]) =>
          `@font-face{font-family:"DejaVu Sans Mono";src:url("/fonts/${key}.ttf");font-weight:${key.includes("bold") ? 700 : 400};font-style:${/Italic|italic/.test(key) ? "italic" : "normal"};}`
      )
      .join("") +
      'body{margin:0}*{box-sizing:border-box}.slide{position:relative;width:1280px;height:720px;background:#fafafa;font-family:"DejaVu Sans Mono";overflow:hidden}h1{margin:0;font-size:48px}p{margin:0;font-size:24px}'
  )
  const chart = JSON.stringify({
    type: "column",
    fontFamily: "DejaVu Sans Mono",
    series: [{ name: "Revenue", labels: ["A", "B"], values: [4, 7] }]
  })
  const fixtures = [
    {
      id: "text",
      jsx: '<p style={{position:"absolute",left:80,top:650}}>{useContext(ParentContext)}</p><h1 style={{position:"absolute",left:80,top:60}}>Editable <span style={{color:"#ff6600"}}>text Ω</span></h1><p style={{position:"absolute",left:80,top:150,fontStyle:"italic"}}>Position, size, and font stay editable. <b>Bold italic</b></p><Animated step={1}><p style={{position:"absolute",left:80,top:240,fontWeight:700}}>Native reveal</p></Animated>'
    },
    {
      id: "shapes",
      jsx: '<div style={{position:"absolute",left:80,top:100,width:380,height:210,borderRadius:32,background:"linear-gradient(45deg,#2563eb,#06b6d4)"}}/><svg width="500" height="350" style={{position:"absolute",left:600,top:100}}><defs><linearGradient id="g"><stop stopColor="#ff6600"/><stop offset="1" stopColor="#ffd000"/></linearGradient></defs><ellipse cx="170" cy="130" rx="160" ry="95" fill="url(#g)"/><path d="M20 280Q180 120 400 280" fill="none" stroke="#172554" strokeWidth="5"/></svg>'
    },
    {
      id: "semantic",
      jsx:
        '<table style={{position:"absolute",left:80,top:80,width:420,fontSize:24,borderCollapse:"collapse"}}><tbody><tr><td>Editable A</td><td>Editable B</td></tr><tr><td colSpan={2}>Merged cell</td></tr></tbody></table><div style={{position:"absolute",left:600,top:100,width:520,height:400}} data-pptx-chart={' +
        JSON.stringify(chart) +
        "}/>"
    },
    {
      id: "image",
      jsx: '<img style={{position:"absolute",left:80,top:80,width:240,height:120}} src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22120%22%3E%3Crect width=%22240%22 height=%22120%22 fill=%22%232563eb%22/%3E%3Ccircle cx=%22120%22 cy=%2260%22 r=%2240%22 fill=%22%23ff6600%22/%3E%3C/svg%3E"/>'
    },
    {
      id: "fallback-conic",
      jsx: '<div style={{position:"absolute",left:150,top:100,width:400,height:300,background:"conic-gradient(red,blue,green,red)"}}/>'
    },
    {
      id: "fallback-blur",
      jsx: '<div style={{position:"absolute",left:150,top:100,width:400,height:300,background:"#ff6600",filter:"blur(18px)",borderRadius:100}}/>'
    }
  ]
  await writeFile(
    join(tmp, "src/deck-config.tsx"),
    'import React,{useContext}from"react";import{Animated}from"promptslide";import{ParentContext}from"./qualification-context";export const slides=[' +
      fixtures
        .map(
          f =>
            `{id:${JSON.stringify(f.id)},steps:${f.id === "text" ? 1 : 0},component:()=> <div className="slide">${f.jsx}</div>}`
        )
        .join(",") +
      "];"
  )
  await writeFile(
    join(tmp, "src/qualification-context.ts"),
    'import{createContext}from"react";export const ParentContext=createContext("Standalone renderer");'
  )
  await writeFile(
    join(tmp, "src/App.tsx"),
    `import{useEffect,useState}from"react";import{SlideDeck,SlideThemeProvider}from"promptslide";import{slides}from"./deck-config";import{theme}from"./theme";import{ParentContext}from"./qualification-context";export default function App(){const[revision,setRevision]=useState(0);useEffect(()=>{const update=()=>setRevision(value=>value+1);window.addEventListener("qualification-rerender",update);return()=>window.removeEventListener("qualification-rerender",update)},[]);const current=slides.map((slide,index)=>({...slide,id:index===0?undefined:index===1?"legacy-1":slide.id}));return <ParentContext value="Provider kept"><SlideThemeProvider theme={{...theme,pptx:{fonts:[{family:"DejaVu Sans Mono",path:"public/fonts/regular.ttf"}]}}}><SlideDeck pptxExport="browser" slides={current}/><span hidden>{revision}</span></SlideThemeProvider></ParentContext>}`
  )
  const config = createViteConfig({ cwd: tmp, editor: false })
  config.base = "/deck/"
  config.server = { host: "127.0.0.1", port: 0, fs: { allow: [root, tmp] } }
  config.logLevel = "error"
  config.plugins.unshift({
    name: "browser-qualification",
    configureServer(devServer) {
      devServer.middlewares.use((request, response, next) => {
        if (!request.url?.split("?")[0].endsWith("/asset.svg")) return next()
        response.setHeader("Content-Type", "image/svg+xml")
        response.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
        )
      })
    },
    resolveId(id) {
      if (id === "/qualification.mjs") return id
    },
    load(id) {
      if (id === "/qualification.mjs")
        return `import{runBrowserCases}from${JSON.stringify(resolve("benchmarks/pptx/browser-cases.mjs"))};window.browserCases=runBrowserCases;import{renderBrowserPptx}from${JSON.stringify(resolve("packages/cli/src/core/export/browser-renderer.tsx"))};import{slides}from${JSON.stringify(join(tmp, "src/deck-config.tsx"))};import{theme}from${JSON.stringify(join(tmp, "src/theme.ts"))};window.browserExport=async(options={})=>{const {stress,...input}=options;const deck=stress?Array.from({length:50},(_,i)=>({...slides[i%slides.length],id:'stress-'+i})):slides;const started=performance.now();const result=await renderBrowserPptx(deck,theme,input);return{bytes:result.pptx?Array.from(result.pptx):null,report:result.report,durationMs:performance.now()-started}};`
    }
  })
  server = await createServer(config)
  await server.listen()
  const url = server.resolvedUrls.local[0]
  browser = await { chromium, firefox, webkit }[
    process.env.PROMPTSLIDE_TEST_BROWSER || "chromium"
  ].launch({
    ...(process.env.PROMPTSLIDE_TEST_BROWSER && process.env.PROMPTSLIDE_TEST_BROWSER !== "chromium"
      ? {}
      : { executablePath: process.env.PROMPTSLIDE_CHROMIUM_PATH })
  })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true
  })
  const requests = [],
    errors = []
  page.on("request", r => requests.push(r.url()))
  page.on("pageerror", e => errors.push(e.message))
  await page.goto(url + "?pptx=true", { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__promptslidePptx?.available)
  await page.evaluate(entry => import(entry), new URL("qualification.mjs", url).href)
  const result = await page.evaluate(() =>
    window.browserExport({ buildMode: "native", timeout: 60 })
  )
  await writeFile(join(out, "browser.pptx"), new Uint8Array(result.bytes))
  await writeFile(join(out, "report.json"), JSON.stringify(result.report, null, 2))
  const zip = await JSZip.loadAsync(new Uint8Array(result.bytes), { checkCRC32: true })
  assert.equal(
    Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length,
    fixtures.length
  )
  assert.ok(Object.keys(zip.files).some(n => n.endsWith(".xlsx")))
  assert.match(await zip.file("ppt/slides/slide1.xml").async("string"), /<p:timing>/)
  assert.match(await zip.file("ppt/slides/slide3.xml").async("string"), /<a:tbl>/)
  assert.equal(result.report.fonts.length, 4)
  assert.equal(
    Object.keys(zip.files).filter(name => /^ppt\/fonts\/[^/]+\.fntdata$/.test(name)).length,
    result.report.fonts.length
  )
  assert.match(await zip.file("ppt/presentation.xml").async("string"), /<p:embeddedFontLst>/)
  assert.ok(
    result.report.metrics.rasterFallbackObjects >= 2 &&
      result.report.metrics.rasterFallbackObjects <= 3
  )
  const before = await page.evaluate(async () => {
    const c = new AbortController()
    c.abort()
    try {
      await window.browserExport({ signal: c.signal })
      return false
    } catch (e) {
      return e.name === "AbortError"
    }
  })
  assert.ok(before)
  const during = await page.evaluate(async () => {
    const c = new AbortController()
    try {
      await window.browserExport({
        signal: c.signal,
        onProgress: p => {
          if (p.phase === "rendering") c.abort()
        }
      })
      return false
    } catch (e) {
      return e.name === "AbortError"
    }
  })
  assert.ok(during)
  assert.equal(await page.locator("[data-ps-browser-export-host]").count(), 0)
  const cases = await page.evaluate(() => window.browserCases())
  const svgZip = await JSZip.loadAsync(new Uint8Array(cases.svgImage.bytes))
  const fallbackName = Object.keys(svgZip.files).find(name => /^ppt\/media\/.*\.png$/.test(name))
  assert.ok(fallbackName)
  const fallbackImage = await svgZip.file(fallbackName).async("base64")
  const redPixels = await page.evaluate(async data => {
    const image = new Image()
    image.src = "data:image/png;base64," + data
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let red = 0
    for (let index = 0; index < pixels.length; index += 4)
      if (
        pixels[index] > 200 &&
        pixels[index + 1] < 40 &&
        pixels[index + 2] < 40 &&
        pixels[index + 3] > 200
      )
        red++
    return red
  }, fallbackImage)
  assert.ok(redPixels > 1000, "External SVG image must remain visible inside the fallback graphic")
  assert.ok(
    !requests.some(assetUrl => /unused-font-/.test(assetUrl)),
    "Host font catalogues must not be fetched"
  )
  await writeFile(
    join(out, "review-cases.json"),
    JSON.stringify(
      {
        fontFallbackEmbedded: cases.font.report.fonts.length === 1,
        hiddenImageIgnored: true,
        externalSvgImageRedPixels: redPixels,
        canvasLimit: cases.canvasLimit,
        oldMarkerCleared: cases.oldMarkerCleared
      },
      null,
      2
    )
  )
  const stress = await page.evaluate(() => window.browserExport({ stress: true, timeout: 120 }))
  await writeFile(join(out, "stress.pptx"), new Uint8Array(stress.bytes))
  const summary = {
    fixtures: fixtures.length,
    bytes: result.bytes.length,
    durationMs: result.durationMs,
    fonts: result.report.fonts.length,
    abortBeforeStart: before,
    abortDuringRender: during,
    cleanup: true,
    stress: { slides: 50, bytes: stress.bytes.length, durationMs: stress.durationMs },
    hostedRequests: requests.filter(u =>
      /__promptslide_exports\/pptx|\/api\/.*exports|vercel\.com/.test(u)
    )
  }
  assert.deepEqual(summary.hostedRequests, [])
  assert.deepEqual(errors, [])
  await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary))
  const ui = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  })
  const uiRequests = []
  ui.on("request", request => uiRequests.push(request.url()))
  ui.on("pageerror", error => errors.push(error.message))
  await ui.goto(url, { waitUntil: "networkidle" })
  await ui.getByRole("button", { name: "Download", exact: true }).click()
  await ui.getByRole("menuitem", { name: "PowerPoint (.pptx)", exact: true }).click()
  const uiDownload = ui.waitForEvent("download")
  await ui.getByRole("button", { name: "Export .pptx", exact: true }).click()
  await ui.evaluate(() => window.dispatchEvent(new Event("qualification-rerender")))
  await (await uiDownload).saveAs(join(out, "provider-context.pptx"))
  const { readFile } = await import("node:fs/promises")
  const uiZip = await JSZip.loadAsync(await readFile(join(out, "provider-context.pptx")), {
    checkCRC32: true
  })
  const uiFirst = await uiZip.file("ppt/slides/slide1.xml").async("string")
  assert.match(uiFirst, /Provider kept/)
  assert.doesNotMatch(uiFirst, /Standalone renderer/)
  assert.ok(uiRequests.some(assetUrl => assetUrl.includes("/deck/fonts/regular.ttf")))
  assert.deepEqual(errors, [])
  await ui.close()
  console.log(
    "Browser UI passed: parent context, rerender during export, sub-path font URL, mixed legacy/explicit IDs"
  )
  const baseline = await exportDeckPptx({
    cwd: tmp,
    baseUrl: url.replace(/\/$/, ""),
    browserExecutable: process.env.PROMPTSLIDE_CHROMIUM_PATH,
    buildMode: "native"
  })
  await writeFile(join(out, "node.pptx"), baseline.pptx)
} finally {
  await Promise.allSettled([browser?.close(), server?.close()])
  await rm(tmp, { recursive: true, force: true })
}
