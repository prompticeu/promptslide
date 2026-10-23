// Isolated theme/portal/keyboard/export/performance checks. Uses installed Chrome.
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"

import { chromium } from "playwright"
import { build, createServer, preview } from "vite"

import { createViteConfig } from "../src/vite/config.mjs"
import { installApplicationQueries } from "./application-browser-helpers.mjs"

const repo = process.cwd()
const root = realpathSync(mkdtempSync(join(tmpdir(), "promptslide-application-ui-")))
let server, browser
const errors = []
const evidence = { checks: [], errors }
const css = `@import "tailwindcss";\n@source "${repo}/packages/cli/src/core";
:root { font-size:30px; --primary: #00ff00; --background: #fff; --foreground: #321654; --font-sans: Georgia,serif; }
body { margin: 30px; padding: 20px; font: italic 700 21px/1.8 Georgia,serif; color: #321654; text-transform: uppercase; background: white; }
button,input,textarea,select { color: #800080 !important; background: #00ff00 !important; border: 7px dashed #ff00ff !important; font: italic 700 27px/1.7 Georgia,serif !important; }
h1 { color:#cc0088; font-size:64px; }`
const source = `export function Slide(){return <div data-authored style={{position:'relative',width:1280,height:720,background:'#fff4d0',padding:70}}><h1>Isolated slide</h1><p>Editable text</p><button>Author button</button><input aria-label="Author field" defaultValue="Slide field"/></div>}`
try {
  mkdirSync(join(root, "src/slides"), { recursive: true })
  symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir")
  writeFileSync(join(root, "package.json"), '{"type":"module"}')
  writeFileSync(join(root, "src/globals.css"), css)
  writeFileSync(
    join(root, "src/theme.ts"),
    "export const theme={colors:{primary:'#00ff00'},fonts:{body:'Georgia'}}"
  )
  writeFileSync(join(root, "src/slides/slide.tsx"), source)
  writeFileSync(
    join(root, "src/deck-config.ts"),
    "import {Slide} from './slides/slide';export const slides=[{id:'isolation',title:'Isolation',component:Slide,steps:0}]"
  )
  writeFileSync(
    join(root, "src/App.tsx"),
    "import {SlideDeck,SlideThemeProvider} from 'promptslide';import {slides} from './deck-config';import {theme} from './theme';export default function App(){return <SlideThemeProvider theme={theme}><SlideDeck slides={slides}/></SlideThemeProvider>}"
  )
  server = await createServer({
    ...createViteConfig({ cwd: root }),
    server: { host: "127.0.0.1", port: 5194, strictPort: true }
  })
  await server.listen()
  browser = await chromium.launch({ channel: "chrome", headless: true })
  const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } })
  page.setDefaultTimeout(15000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installApplicationQueries(page)
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("http://127.0.0.1:5194", { waitUntil: "networkidle" })
  const settings = page.getByRole("button", { name: "Slide settings", exact: true })
  const styles = locator =>
    locator.evaluate(el => {
      const s = getComputedStyle(el)
      return {
        font: s.fontFamily,
        size: s.fontSize,
        color: s.color,
        background: s.backgroundColor,
        border: s.borderWidth,
        transform: s.textTransform
      }
    })
  const appBefore = await styles(settings)
  assert.ok(!appBefore.font.includes("Georgia"))
  assert.equal(appBefore.size, "12px")
  assert.equal(appBefore.transform, "none")
  assert.equal(Math.round((await settings.boundingBox()).width), 32)
  const authored = page.locator("[data-ps-editor-canvas] [data-authored]")
  const sourceBefore = await styles(authored.locator("h1"))
  assert.ok(sourceBefore.font.includes("Georgia"))
  assert.equal((await styles(authored.getByRole("button"))).background, "rgb(0, 255, 0)")
  assert.equal((await settings.boundingBox()).y < 100, true)
  evidence.checks.push(
    "Hostile body margin/padding/fonts, semantic tokens and !important broad control rules stay out of application UI"
  )
  await settings.click()
  assert.equal(await settings.getAttribute("aria-pressed"), "true")
  await page.waitForFunction(
    () =>
      getComputedStyle(window.psQuery('button[aria-label="Slide settings"]')).color ===
      "rgb(255, 107, 53)"
  )
  assert.equal((await styles(settings)).color, "rgb(255, 107, 53)")
  const selectedBefore = await styles(settings)
  await page.getByRole("region", { name: "Slide settings", exact: true }).waitFor()
  const panelHeading = page
    .getByRole("region", { name: "Slide settings", exact: true })
    .getByRole("heading", { name: "Isolation", exact: true })
  assert.equal((await styles(panelHeading)).size, "16px")
  const checkbox = page.getByRole("checkbox", {
    name: "Include current slide in loop",
    exact: true
  })
  assert.equal(
    await checkbox.locator("svg").evaluate(el => getComputedStyle(el).color),
    "rgb(255, 255, 255)"
  )
  const slideIndex = await authored.evaluate(
    el => el.closest("[data-ps-editor-canvas]").dataset.slideIndex
  )
  await checkbox.focus()
  await page.keyboard.press("Space")
  assert.equal(await checkbox.isChecked(), false)
  assert.equal(
    await authored.evaluate(el => el.closest("[data-ps-editor-canvas]").dataset.slideIndex),
    slideIndex
  )
  await checkbox.press("Space")
  const view = page.getByRole("button", { name: "View options", exact: true })
  await view.focus()
  await page.keyboard.press("ArrowDown")
  const menu = page.getByRole("menu", { name: "View options", exact: true })
  await menu.waitFor()
  assert.ok(!(await styles(menu)).font.includes("Georgia"))
  assert.equal((await styles(menu)).color, "rgb(245, 245, 245)")
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => window.psActive()?.getAttribute("aria-label") === "View options")
  evidence.checks.push(
    "Menu arrows/Escape restore focus inside Shadow DOM; checkbox Space does not advance slides; selected action and checkmark retain orange/white"
  )
  // Different authored stylesheet, including broad descendant rules and new inheritance.
  await page.addStyleTag({
    content:
      ':root{font-size:9px;--primary:#0000ff;--foreground:yellow}body{font-family:"Courier New";color:yellow;text-transform:lowercase}*{font-family:"Courier New" !important}button{background:red !important;color:yellow !important}h1{color:blue !important}'
  })
  await page.waitForFunction(() =>
    getComputedStyle(document.querySelector("[data-ps-editor-canvas] h1")).fontFamily.includes(
      "Courier"
    )
  )
  assert.deepEqual(await styles(settings), selectedBefore)
  assert.equal((await styles(panelHeading)).size, "16px")
  await view.click()
  await menu.waitFor()
  assert.ok(!(await styles(menu)).font.includes("Courier"))
  await page.keyboard.press("Escape")
  await settings.hover()
  await page.getByRole("tooltip").filter({ hasText: "Slide settings" }).waitFor()
  assert.ok(
    !(await styles(page.getByRole("tooltip").filter({ hasText: "Slide settings" }))).font.includes(
      "Courier"
    )
  )
  evidence.checks.push(
    "Contrasting live slide theme and universal !important font rules leave controls, open menus and tooltips unchanged"
  )
  // The shared inspector can veto a tab change, preserve the draft, then discard it.
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  const editor = page.getByRole("complementary", { name: "Format panel", exact: true })
  await editor.waitFor()
  await authored.locator("h1").click()
  await editor.getByLabel("Text", { exact: true }).fill("Buffered edit")
  await page.getByRole("tab", { name: "Comments", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Save your changes?" })
  await dialog.waitFor()
  assert.ok(!(await styles(dialog)).font.includes("Courier"))
  await page.waitForFunction(() => !!window.psActive()?.closest('[role="dialog"]'))
  const focusedActions = []
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press("Tab")
    await page.waitForFunction(() => !!window.psActive()?.closest('[role="dialog"]'))
    focusedActions.push(await page.evaluate(() => window.psActive()?.textContent?.trim()))
    assert.equal(await page.evaluate(() => !!window.psActive()?.closest('[role="dialog"]')), true)
  }
  assert.ok(focusedActions.includes("Discard changes") && focusedActions.includes("Save changes"))
  await dialog.getByRole("button", { name: "Keep editing", exact: true }).click()
  assert.equal(await editor.getByLabel("Text", { exact: true }).inputValue(), "Buffered edit")
  await page.getByRole("tab", { name: "Slide", exact: true }).click()
  await dialog.getByRole("button", { name: "Discard changes", exact: true }).click()
  await page.getByRole("region", { name: "Slide settings", exact: true }).waitFor()
  evidence.checks.push(
    "Separate editor root shares the application theme and portal host; Save/Discard/Keep editing guard preserves buffered text"
  )
  await page.getByRole("button", { name: "Comment", exact: true }).click()
  const paragraph = await page.locator("[data-ps-editor-canvas] p").boundingBox()
  await page.mouse.click(paragraph.x + 30, paragraph.y + paragraph.height / 2)
  const note = page.getByRole("dialog", { name: "Add annotation", exact: true })
  await note.waitFor()
  await note.getByPlaceholder("Describe the change you want...").fill("Isolated comment")
  await note.getByRole("button", { name: "Add annotation", exact: true }).click()
  await page.getByText("Isolated comment", { exact: true }).waitFor()
  evidence.checks.push(
    "Annotation overlay resolves light-DOM targets; deferred non-modal comment form retains its application theme and persists a comment"
  )
  await page.getByRole("tab", { name: "Slide", exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true })
  assert.ok((await inspector.boundingBox()).width <= 390)
  await page.getByRole("button", { name: "Close slide settings", exact: true }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.getByRole("button", { name: "Comment", exact: true }).click()
  const mobileTarget = await page.locator("[data-ps-editor-canvas]").boundingBox()
  await page.mouse.click(mobileTarget.x + 4, mobileTarget.y + mobileTarget.height / 2)
  await note.waitFor()
  const mobileNote = await note.boundingBox()
  assert.ok(mobileNote.width >= 280 && mobileNote.width <= 358)
  assert.ok(mobileNote.x >= 0 && mobileNote.x + mobileNote.width <= 390)
  assert.equal(
    (await styles(note.getByPlaceholder("Describe the change you want..."))).size,
    "14px"
  )
  await note.getByRole("button", { name: "Cancel annotation", exact: true }).click()
  await page.getByRole("button", { name: "Hide comments", exact: true }).click()
  evidence.checks.push(
    "Mobile annotation popover stays at application size beside the scaled canvas and fits the viewport"
  )
  await page.getByRole("button", { name: "Present", exact: true }).click()
  await page.waitForFunction(() => !!document.fullscreenElement)
  assert.equal(
    await page.evaluate(() =>
      document.fullscreenElement.contains(document.querySelector("[data-ps-app-host]"))
    ),
    true
  )
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)
  await page.getByRole("button", { name: "Present", exact: true }).focus()
  await page.keyboard.press("f")
  await page.waitForFunction(() => !!document.fullscreenElement)
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)

  evidence.checks.push(
    "Mobile inspector fits viewport; published presentation enters/exits fullscreen with portal host inside the fullscreen element"
  )
  // Compare live and export styles using the same original stylesheet, no injected variant.
  await page.setViewportSize({ width: 1800, height: 1100 })
  await page.reload({ waitUntil: "networkidle" })
  assert.deepEqual(await styles(page.locator("[data-ps-editor-canvas] h1")), sourceBefore)
  const liveStyles = await styles(page.locator("[data-ps-editor-canvas] h1"))
  await page.screenshot({ path: "/tmp/promptslide-application-isolation.png" })
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download PDF", exact: true }).click()
  const download = await downloading
  assert.equal(download.suggestedFilename(), "slides.pdf")
  assert.equal(await download.failure(), null)
  evidence.checks.push(
    "Download PDF completes through the actual Studio endpoint using installed Chrome fallback"
  )
  await page.goto("http://127.0.0.1:5194/?export=true&slidePath=src/slides/slide.tsx", {
    waitUntil: "networkidle"
  })
  await page.locator("[data-export-ready=true]").waitFor()
  assert.deepEqual(await styles(page.locator("h1")), liveStyles)
  assert.equal(await page.getByRole("button", { name: "Edit slide", exact: true }).count(), 0)
  await page.goto("http://127.0.0.1:5194/?pdf=true", { waitUntil: "networkidle" })
  await page.locator("[data-pdf-ready=true]").waitFor()
  const pdf = await page.pdf({ width: "1280px", height: "720px", printBackground: true })
  assert.ok(pdf.length > 1000)
  evidence.checks.push(
    "Authored heading styles match live canvas and standalone export; PDF renders with original theme and excludes editor controls"
  )
  await server.close()
  server = undefined
  writeFileSync(
    join(root, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>'
  )
  writeFileSync(
    join(root, "main.js"),
    `import {createElement} from 'react';import {createRoot} from 'react-dom/client';import {SlideDeck} from 'promptslide';function Slide(){return createElement('div',{style:{width:1280,height:720,padding:80,fontFamily:'Georgia',color:'purple',background:'#fff'}},createElement('h1',null,'Plain SDK slide'))}createRoot(document.getElementById('root')).render(createElement(SlideDeck,{slides:[{id:'plain',component:Slide,steps:0}]}))`
  )
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    resolve: { dedupe: ["react", "react-dom"] },
    build: { outDir: join(root, "sdk-dist") }
  })
  server = await preview({
    configFile: false,
    root,
    build: { outDir: join(root, "sdk-dist") },
    preview: { host: "127.0.0.1", port: 5194, strictPort: true }
  })
  await page.goto("http://127.0.0.1:5194", { waitUntil: "networkidle" })
  assert.equal(await page.locator('link[rel="stylesheet"]').count(), 0)
  assert.ok(
    !(
      await styles(page.getByRole("button", { name: "Slide settings", exact: true }))
    ).font.includes("Georgia")
  )
  await page.getByRole("button", { name: "View options", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Grid view", exact: true }).click()
  assert.equal(await page.getByRole("button", { name: "Edit slide", exact: true }).count(), 0)
  evidence.checks.push(
    "Published SDK controls render and open menus in a plain Vite consumer with no stylesheet, Tailwind plugin or shadcn configuration"
  )
  await page.emulateMedia({ media: "print" })
  const printCanvas = page.locator("[data-ps-list-canvas]").first()
  await printCanvas.waitFor()
  assert.equal(
    await printCanvas.evaluate(el => getComputedStyle(el).transform),
    "matrix(1.5, 0, 0, 1.5, 0, 0)"
  )
  const fallbackPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  assert.ok(fallbackPdf.length > 1000)
  assert.match(fallbackPdf.toString("latin1"), /\/MediaBox\s*\[\s*0\s+0\s+1440\s+810\s*\]/)
  evidence.checks.push(
    "Static SDK print fallback uses the original 1920x1080 page and 1.5x slide canvas scale"
  )
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(evidence, null, 2))
  writeFileSync(
    resolve("docs/bundle-measurements/application-browser.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
} catch (error) {
  console.error(error)
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages())
      await page.screenshot({ path: "/tmp/promptslide-application-failure.png" }).catch(() => {})
  throw error
} finally {
  await browser?.close()
  await server?.close()
  rmSync(root, { recursive: true, force: true })
}
