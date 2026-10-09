// Run explicitly: node packages/cli/test/editor.browser.mjs
// Uses an isolated deck so save/conflict checks never change the user's slides.
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  realpathSync,
  cpSync
} from "node:fs"
import { createServer as createPortServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { chromium } from "playwright"
import { createServer, build, createLogger } from "vite"

import { createViteConfig } from "../src/vite/config.mjs"
const root = realpathSync(mkdtempSync(join(tmpdir(), "promptslide-editor-browser-")))
mkdirSync(join(root, "src/slides"), { recursive: true })
symlinkSync(realpathSync(resolve("node_modules")), join(root, "node_modules"))
writeFileSync(join(root, "src/globals.css"), readFileSync("src/globals.css"))
writeFileSync(join(root, "src/theme.ts"), "export const theme = {}")
writeFileSync(
  join(root, "src/App.tsx"),
  'import {SlideDeck} from "promptslide";import {slides} from "./deck-config";export default function App(){return <SlideDeck slides={slides}/>}'
)
writeFileSync(
  join(root, "src/deck-config.ts"),
  'import {Slide,Another} from "./slides/slide";export const slides=[{id:"test",component:Slide,steps:1},{id:"another",component:Another,steps:0}]'
)
const path = join(root, "src/slides/slide.tsx")
const original = `import {Presentation} from 'lucide-react'
import {Animated} from 'promptslide'
const items=[{title:'First item'},{title:'Second item'}]
function Title({title}:{title:string}) {return <h2>{title}</h2>}
export function Slide(){return <div style={{position:'relative',width:1280,height:720,background:'#151515',color:'white',padding:80}}><Presentation style={{position:"absolute",right:40,top:40,width:48,height:48}}/><h1 style={{fontSize:64}}>Editor test</h1><p>Editable paragraph</p><Title title="Component title"/><div>{items.map(item=><p key={item.title}>{item.title}</p>)}</div><Animated step={1}><p>Revealed content</p></Animated><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" alt="Fixture" style={{width:100,height:100}}/></div>}`
writeFileSync(
  path,
  original +
    "\nexport function Another(){return <div style={{padding:80}}><h1>Another slide</h1><p>Second slide text</p></div>}"
)
mkdirSync(join(root, "public"))
writeFileSync(
  join(root, "public/pixel.png"),
  Buffer.from(original.match(/base64,([^" ]+)/)[1], "base64")
)
let server, browser
try {
  // Vite 6 treats port: 0 as its default 5173. Reserve an OS-assigned port
  // instead, so an existing preview tab cannot reconnect to this fixture.
  const portServer = createPortServer()
  await new Promise((ready, reject) => {
    portServer.once("error", reject)
    portServer.listen(0, "127.0.0.1", ready)
  })
  const port = portServer.address().port
  await new Promise((closed, reject) =>
    portServer.close(error => (error ? reject(error) : closed()))
  )
  const errors = []
  const logger = createLogger()
  const logError = logger.error.bind(logger)
  logger.error = (message, options) => {
    errors.push(`Dev server: ${message}`)
    logError(message, options)
  }
  // Exercise editor HMR using a private copy, without touching the user's editor or deck.
  const editorDirectory = join(root, "editor")
  cpSync(resolve("packages/cli/src/editor"), editorDirectory, { recursive: true })
  writeFileSync(
    join(root, "src/globals.css"),
    readFileSync("src/globals.css", "utf8") + `\n@source "${editorDirectory}";\n`
  )
  const { editorPlugin } = await import(join(editorDirectory, "plugin.mjs"))
  const config = createViteConfig({ cwd: root })
  config.plugins = config.plugins.map(plugin =>
    plugin?.name === "promptslide-editor" ? editorPlugin({ root }) : plugin
  )
  server = await createServer({
    ...config,
    customLogger: logger,
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      fs: { allow: [root, process.cwd(), realpathSync("node_modules")] }
    }
  })
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(15000)
  let expectedConflict = false
  let conflictConsoleErrors = 0
  page.on("console", msg => {
    if (msg.type() !== "error") return
    // This is the single HTTP error deliberately exercised by the conflict test.
    if (
      expectedConflict &&
      msg.text() === "Failed to load resource: the server responded with a status of 409 (Conflict)"
    ) {
      conflictConsoleErrors++
      return
    }
    errors.push(`Console: ${msg.text()}`)
  })
  console.log("Browser started")
  page.on("pageerror", e => errors.push(e.stack || e.message))
  await page.goto(`http://127.0.0.1:${address.port}`, { timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  const liveCanvas = page.locator("[data-ps-editor-canvas]")
  const originalPixels = await liveCanvas.screenshot()
  const originalStyles = await liveCanvas.locator("[data-ps-source]").evaluateAll(elements =>
    elements.map(el => {
      const c = getComputedStyle(el)
      return [
        c.fontFamily,
        c.fontSize,
        c.fontWeight,
        c.lineHeight,
        c.color,
        c.backgroundColor,
        c.padding,
        c.margin,
        c.display,
        c.width,
        c.height
      ]
    })
  )
  await page.evaluate(() => {
    window.testOriginalCanvas = document.querySelector("[data-ps-editor-canvas]")
    window.testOriginalHeading = window.testOriginalCanvas.querySelector("h1")
  })
  console.log("Opening editor")
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  await page.setViewportSize({ width: 1760, height: 900 })
  await page.waitForTimeout(250)
  assert.equal(
    await page.evaluate(
      () =>
        window.testOriginalCanvas === document.querySelector("[data-ps-editor-canvas]") &&
        window.testOriginalHeading === document.querySelector("[data-ps-editor-canvas] h1")
    ),
    true
  )
  assert.deepEqual(
    await liveCanvas.locator("[data-ps-source]").evaluateAll(elements =>
      elements.map(el => {
        const c = getComputedStyle(el)
        return [
          c.fontFamily,
          c.fontSize,
          c.fontWeight,
          c.lineHeight,
          c.color,
          c.backgroundColor,
          c.padding,
          c.margin,
          c.display,
          c.width,
          c.height
        ]
      })
    ),
    originalStyles
  )
  assert.deepEqual(
    await liveCanvas.screenshot(),
    originalPixels,
    "Opening Edit must not change a pixel of the slide at the same scale"
  )
  assert.equal(await page.locator(".ps-launch,.ps-canvas,.ps-slide-surface").count(), 0)
  console.log("PASS identical original slide DOM, computed styles and pixels on editor activation")
  const editor = page.locator(".ps-panel")
  const button = name => editor.getByRole("button", { name, exact: true })
  const chooseElement = async (name, options = {}) => {
    const summary = editor.getByText("Slide elements", { exact: true })
    if (!(await summary.evaluate(el => el.closest("details").open))) await summary.click()
    await editor.locator(".ps-layer-list").getByRole("button", { name, exact: true }).click(options)
  }
  await page
    .locator("[data-ps-editor-canvas] [data-slide-render-index] > div")
    .click({ position: { x: 5, y: 5 } })
  const headingBox = await page.locator("[data-ps-editor-canvas] h1").boundingBox()
  await page.mouse.dblclick(
    headingBox.x + headingBox.width / 2,
    headingBox.y + headingBox.height / 2
  )
  await editor.getByLabel("Text", { exact: true }).waitFor()
  assert.equal(await editor.getByLabel("Text", { exact: true }).inputValue(), "Editor test")
  await editor.getByRole("tab", { name: "Arrange", exact: true }).click()
  assert.equal(await page.locator(".ps-selection").count(), 1)
  await editor.getByRole("tab", { name: "Design", exact: true }).click()
  await page.mouse.dblclick(
    headingBox.x + headingBox.width / 2,
    headingBox.y + headingBox.height / 2
  )
  await page.getByLabel("Edit text inline").fill("Outside commit")
  await page.mouse.click(400, 85)
  assert.equal(await page.locator(".ps-selection").count(), 0)
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Outside commit")
  const draftBeforeHmr = await page.evaluate(() =>
    sessionStorage.getItem("promptslide:editor-draft")
  )
  let navigations = 0
  const onNavigation = frame => {
    if (frame === page.mainFrame()) navigations++
  }
  page.on("framenavigated", onNavigation)
  const studioPath = join(editorDirectory, "studio.tsx")
  const studioSource = readFileSync(studioPath, "utf8")
  writeFileSync(studioPath, studioSource.replace("SLIDE EDITOR", "LIVE SLIDE EDITOR"))
  const editorCssPath = join(editorDirectory, "studio.css")
  const editorCss = readFileSync(editorCssPath, "utf8")
  writeFileSync(editorCssPath, editorCss + "\n.ps-save { outline-offset: 3px; }\n")
  await editor.getByText("LIVE SLIDE EDITOR", { exact: true }).waitFor()
  assert.equal(navigations, 0, "Editor code updates must not reload a dirty page")
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("promptslide:editor-draft")),
    draftBeforeHmr
  )
  await page.waitForFunction(
    () => document.querySelector("[data-ps-editor-canvas] h1")?.textContent === "Outside commit"
  )
  writeFileSync(studioPath, studioSource)
  await editor.getByText("SLIDE EDITOR", { exact: true }).waitFor()
  writeFileSync(editorCssPath, editorCss)
  await page.waitForTimeout(500)
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("promptslide:editor-draft")),
    draftBeforeHmr
  )
  assert.equal(
    await page
      .getByRole("button", { name: "Edit slide", exact: true })
      .getAttribute("aria-pressed"),
    "true"
  )
  assert.equal(await editor.isVisible(), true)
  assert.equal(await button("Undo").isEnabled(), true, "Hot updates must retain draft history")
  page.off("framenavigated", onNavigation)
  console.log("PASS editor code hot updates without navigation or draft loss")
  await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "Editable paragraph" }).click()
  await editor.getByLabel("Text", { exact: true }).press("End")
  await editor.getByLabel("Text", { exact: true }).press("Backspace")
  assert.equal(
    await page
      .locator("[data-ps-editor-canvas] p")
      .filter({ hasText: "Editable paragrap" })
      .isVisible(),
    true
  )
  for (const key of ["Delete", "Backspace"]) {
    await page.locator("[data-ps-editor-canvas] h1").click()
    assert.equal(
      await page.evaluate(() => document.activeElement?.hasAttribute("data-ps-editor-canvas")),
      true
    )
    await page.keyboard.press(key)
    assert.equal(await page.locator("[data-ps-editor-canvas] h1").isVisible(), false)
    await button("Undo").click()
    assert.equal(await page.locator("[data-ps-editor-canvas] h1").isVisible(), true)
    await page.mouse.click(400, 85)
  }
  console.log(
    "PASS Delete/Backspace remove selections after text-field focus and Undo restores them"
  )
  await button("Discard").click()
  console.log(
    "PASS group drill-down, sidebar selection retention, outside deselection and inline commit"
  )
  await page.locator("[data-ps-editor-canvas] svg.lucide").click()
  await editor.getByRole("heading", { name: "Icon", exact: true }).waitFor()
  await editor.getByLabel("Line thickness", { exact: true }).fill("3")
  await editor.getByLabel("Line thickness", { exact: true }).press("Tab")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] svg.lucide").evaluate(el => el.style.strokeWidth),
    "3"
  )
  await button("Save changes").click()
  await page.waitForTimeout(500)
  assert.match(readFileSync(path, "utf8"), /strokeWidth/)
  await chooseElement("Icon")
  await editor.getByLabel("Icon color", { exact: true }).waitFor()
  await page.mouse.click(400, 85)
  console.log("PASS Lucide icon selection, formatting, save and element list")
  await page.locator("[data-ps-editor-canvas] h1").click()
  const text = editor.getByLabel("Text", { exact: true })
  await text.fill("Discard this title")
  await button("Done editing").click()
  const closeDialog = page.getByRole("dialog", { name: "Save your changes?" })
  await closeDialog.getByRole("button", { name: "Keep editing" }).click()
  assert.equal(await text.inputValue(), "Discard this title")
  await button("Done editing").click()
  await closeDialog.getByRole("button", { name: "Discard changes" }).click()
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  await page.locator("[data-ps-editor-canvas] h1").click()
  assert.equal(await text.inputValue(), "Editor test")
  await text.fill("Changed title")
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Changed title")
  await button("Undo").click()
  assert.equal(await text.inputValue(), "Editor test")
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Editor test")
  await button("Redo").click()
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Changed title")
  await button("Done editing").click()
  await closeDialog.getByRole("button", { name: "Save changes" }).click()
  await page.locator(".ps-panel").waitFor({ state: "detached" })
  assert.match(readFileSync(path, "utf8"), /Changed title/)
  console.log("PASS close dialog keep editing, discard, and save")
  await page.waitForTimeout(250)
  await page.reload()
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Changed title")
  console.log("PASS text, undo/redo, save and reload")
  await page.locator("[data-ps-editor-canvas] h1").click()
  await text.fill("Conflict draft")
  const saved = readFileSync(path, "utf8")
  writeFileSync(path, saved + "\n// concurrent agent change\n")
  await page.waitForTimeout(400)
  await button("Done editing").click()
  expectedConflict = true
  const conflictResponse = page.waitForResponse(
    response => response.url().endsWith("/__promptslide_editor") && response.status() === 409
  )
  await closeDialog.getByRole("button", { name: "Save changes" }).click()
  await conflictResponse
  await closeDialog.getByRole("alert").waitFor()
  assert.equal(await closeDialog.isVisible(), true)
  await closeDialog.getByRole("button", { name: "Keep editing" }).click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-error")?.textContent?.includes("changed elsewhere")
  )
  assert.ok(readFileSync(path, "utf8").includes("concurrent agent change"))
  assert.ok(!readFileSync(path, "utf8").includes("Conflict draft"))
  await button("Discard").click()
  expectedConflict = false
  assert.ok(conflictConsoleErrors <= 1, "Only the deliberate save conflict may log an HTTP error")
  console.log("PASS concurrent edit conflict preserves external source")
  await page.waitForTimeout(250)
  await page.reload()
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "Second item" }).click()
  await editor.getByRole("button", { name: "Edit shared component" }).waitFor()
  assert.equal(await editor.getByLabel("Font size", { exact: true }).isDisabled(), true)
  await editor.getByRole("button", { name: "Edit shared component" }).click()
  assert.equal(await editor.getByRole("button", { name: /Finish editing/ }).count(), 0)
  assert.equal(await editor.getByLabel("Font size", { exact: true }).isEnabled(), true)
  console.log("PASS shared appearance requires explicit opt-in")

  await text.fill("Only second changed")
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  assert.match(readFileSync(path, "utf8"), /title:'First item'/)
  assert.match(readFileSync(path, "utf8"), /Only second changed/)
  console.log("PASS repeated array instance editing")
  await page.waitForTimeout(400)
  await page.locator("[data-ps-editor-canvas] h1").click()
  const selection = page.locator(".ps-selection"),
    box = await selection.boundingBox()
  const before = await page.locator("[data-ps-editor-canvas] h1").boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.down("Alt")
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 24, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up("Alt")
  const after = await page.locator("[data-ps-editor-canvas] h1").boundingBox()
  console.log("DRAG", { before, after })
  assert.ok(Math.abs(after.x - before.x - 40) < 2)
  assert.ok(Math.abs(after.y - before.y - 24) < 2)
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  assert.match(readFileSync(path, "utf8"), /translate/)
  console.log("PASS scaled drag and persisted position")
  await page.waitForTimeout(350)
  // Inline editing, appearance, and resize are real browser gestures.
  await page.locator("[data-ps-editor-canvas] h1").click()
  await page.locator(".ps-selection").dblclick()
  await page.getByLabel("Edit text inline").fill("Inline title")
  await editor.locator(".ps-panel-heading h2").click()
  assert.equal(await page.locator("[data-ps-editor-canvas] h1").textContent(), "Inline title")
  await editor.getByLabel("Font size", { exact: true }).fill("56")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h1").evaluate(el => getComputedStyle(el).fontSize),
    "56px"
  )
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  await page.locator("[data-ps-editor-canvas] img").click()
  const imageBefore = await page.locator("[data-ps-editor-canvas] img").boundingBox()
  const handle = await page
    .getByRole("button", { name: "Resize element", exact: true })
    .boundingBox()
  await page.mouse.move(handle.x + 6, handle.y + 6)
  await page.mouse.down()
  await page.mouse.move(handle.x + 36, handle.y + 26, { steps: 5 })
  await page.mouse.up()
  const imageAfter = await page.locator("[data-ps-editor-canvas] img").boundingBox()
  assert.ok(imageAfter.width > imageBefore.width + 25)
  await editor.getByRole("tab", { name: "Arrange" }).click()
  await editor.getByLabel("Rotation", { exact: true }).fill("15")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] img").evaluate(el => el.style.rotate),
    "15deg"
  )
  await editor.getByRole("tab", { name: "Design" }).click()
  await editor.getByLabel("Crop edges").focus()
  await page.keyboard.press("ArrowRight")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] img").evaluate(el => el.style.clipPath),
    "inset(1%)"
  )
  await editor.getByLabel("Image focus", { exact: true }).selectOption("0% 50%")
  await editor.getByLabel("Image address", { exact: true }).fill("/pixel.png")
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.match(readFileSync(path, "utf8"), /15deg/)
  assert.match(readFileSync(path, "utf8"), /0% 50%/)
  console.log("PASS inline text, appearance, image resize and rotation")
  // Range formatting emits editable JSX spans and safely preserves the remainder.
  await chooseElement("Editable paragraph")
  await text.evaluate(el => {
    el.focus()
    el.setSelectionRange(0, 8)
  })
  await button("Bold").click()
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p span").first().textContent(),
    "Editable"
  )
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.match(readFileSync(path, "utf8"), /<span style=/)
  console.log("PASS rich-text range formatting")
  await page.locator("[data-ps-editor-canvas] h1").click()
  await chooseElement("Editable paragraph", { modifiers: ["Shift"] })
  await editor.getByRole("tab", { name: "Arrange" }).click()
  await button("Align left").click()
  const headingAligned = await page.locator("[data-ps-editor-canvas] h1").boundingBox()
  const paragraphAligned = await page
    .locator("[data-ps-editor-canvas] p")
    .filter({ hasText: "Editable paragraph" })
    .boundingBox()
  assert.ok(Math.abs(headingAligned.x - paragraphAligned.x) < 1)
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  console.log("PASS multiselect alignment")
  // Select a source container through Layers, insert, duplicate, and delete.
  await page
    .locator("[data-ps-editor-canvas] [data-slide-render-index] > div")
    .click({ position: { x: 5, y: 5 } })

  await editor.getByText("Add to this group", { exact: true }).click()
  await button("Text").click()
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    1
  )
  await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).click()

  await button("Duplicate").click()
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    2
  )
  await button("Undo").click()
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    1
  )
  await button("Redo").click()
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    2
  )
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    2
  )
  if (
    !(await editor
      .getByText("Slide elements", { exact: true })
      .evaluate(el => el.closest("details").open))
  )
    await editor.getByText("Slide elements", { exact: true }).click()
  await editor.getByRole("button", { name: "New text", exact: true }).last().click()

  await button("Delete").click()
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.equal(
    await page.locator("[data-ps-editor-canvas] p").filter({ hasText: "New text" }).count(),
    1
  )
  console.log("PASS insertion, duplication and deletion")
  // Edit mode keeps native animation state and navigation; it adds no alternate preview.
  await button("Done editing").click()
  await page.getByTitle("Next step or slide (→ / Space)").click()
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("[data-ps-editor-canvas] p")).find(
        el => el.textContent === "Revealed content"
      )?.parentElement?.style.opacity === "1"
  )
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  await page.getByRole("button", { name: "Go to slide 2", exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector("[data-ps-editor-canvas]")?.getAttribute("data-slide-index") === "1"
  )
  await page.waitForTimeout(400)
  await page.locator("[data-ps-editor-canvas] h1").click()
  await text.fill("Another edited title")
  await page.getByRole("button", { name: "Go to slide 1", exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: "Go to slide 2", exact: true }).click()
  await page.waitForTimeout(400)
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h1").textContent(),
    "Another edited title"
  )
  await button("Discard").click()
  await page.waitForTimeout(200)
  await page.getByRole("button", { name: "Go to slide 1", exact: true }).click()
  await page.waitForTimeout(400)
  console.log("PASS native reveals and slide navigation preserve buffered edits")
  await page.locator("[data-ps-editor-canvas] h2").click()
  await editor.getByLabel("Text", { exact: true }).waitFor()
  assert.equal(await editor.getByLabel("Text", { exact: true }).inputValue(), "Component title")
  assert.equal(await editor.getByText("Linked content", { exact: true }).count(), 0)
  await editor.getByRole("heading", { name: "Shared component", exact: true }).waitFor()
  assert.equal(await editor.getByLabel("Font size", { exact: true }).isDisabled(), true)
  assert.equal(await editor.getByLabel("Text", { exact: true }).isEnabled(), true)
  assert.equal(await button("Duplicate").isDisabled(), true)
  assert.equal(await button("Delete").isDisabled(), true)
  assert.equal(await page.getByLabel("Resize element", { exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel("Rotate element", { exact: true }).isDisabled(), true)
  const beforeLockedEdit = await page.locator("[data-ps-editor-canvas] h2").getAttribute("style")
  await page.mouse.click(400, 85)
  await page.locator("[data-ps-editor-canvas] h2").click()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Delete")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h2").getAttribute("style"),
    beforeLockedEdit
  )
  assert.equal(await page.locator("[data-ps-editor-canvas] h2").isVisible(), true)
  await button("Edit shared component").click()
  assert.equal(await page.getByLabel("Resize element", { exact: true }).isEnabled(), true)
  // This text is the component root, so structural actions remain unsupported.
  assert.equal(await button("Duplicate").isDisabled(), true)
  assert.equal(await button("Delete").isDisabled(), true)
  await button("Accent text color").click()
  await editor.getByLabel("Font size", { exact: true }).fill("30")
  await editor.getByLabel("Font size", { exact: true }).press("Tab")
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h2").evaluate(el => el.style.fontSize),
    "30px"
  )
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h2").evaluate(el => el.style.color),
    "var(--primary)"
  )
  await editor.getByLabel("Text", { exact: true }).fill("Updated component title")
  await button("Save changes").click()
  await page.waitForFunction(() =>
    document.querySelector(".ps-save-status")?.textContent?.includes("All changes saved")
  )
  await page.waitForTimeout(350)
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h2").textContent(),
    "Updated component title"
  )
  assert.equal(
    await page.locator("[data-ps-editor-canvas] h2").evaluate(el => el.style.fontSize),
    "30px"
  )
  console.log("PASS linked component content and formatting target the rendered text")
  await page.setViewportSize({ width: 1000, height: 700 })
  await page.screenshot({ path: "/tmp/promptslide-editor-browser.png" })
  await button("Done editing").click()
  assert.equal(await page.locator("#root").evaluate(el => el.inert), false)
  assert.equal(errors.length, 0, errors.join("\n"))
  console.log("PASS editor close restores presentation; no browser errors")
  // React can report caught render errors through window.reportError. Verify
  // both Playwright and the terminal-forwarding path are actually monitored.
  const probe = "Runtime error capture probe"
  const forwardedProbe = page.waitForResponse(
    response => response.url().endsWith("/__promptslide_error") && response.status() === 204
  )
  await page.evaluate(message => window.reportError(new Error(message)), probe)
  await forwardedProbe
  assert.ok(errors.some(message => message.startsWith("Error:") && message.includes(probe)))
  assert.ok(errors.some(message => message.startsWith("Dev server:") && message.includes(probe)))
  assert.ok(
    errors.every(message => message.includes(probe)),
    errors.join("\n")
  )
  errors.length = 0
  console.log(
    "PASS runtime-error guard catches page errors and forwarded React error reports (intentional probe)"
  )
  // Build through the real entry, then assert the development editor is absent.
  writeFileSync(
    join(root, "index.html"),
    '<!doctype html><div id="root"></div><script type="module" src="/main.js"></script>'
  )
  writeFileSync(join(root, "main.js"), 'import "virtual:promptslide-entry"')
  await build({
    ...createViteConfig({ cwd: root, mode: "production" }),
    logLevel: "silent",
    build: { outDir: join(root, "dist") }
  })
  const { readdirSync } = await import("node:fs")
  const bundles = readdirSync(join(root, "dist/assets"))
    .filter(f => f.endsWith(".js"))
    .map(f => readFileSync(join(root, "dist/assets", f), "utf8"))
    .join("\n")
  assert.ok(!bundles.includes("__promptslide_editor"))
  assert.ok(!bundles.includes("data-ps-source"))
  assert.ok(!bundles.includes("ps-panel-heading"))
  assert.equal(errors.length, 0, errors.join("\n"))
  console.log("PASS production bundle excludes editor, source metadata and write endpoints")
} catch (error) {
  console.error(error)
  for (const context of browser?.contexts() || [])
    for (const page of context.pages()) {
      await page.screenshot({ path: "/tmp/promptslide-editor-failure.png" })
      console.log((await page.locator("body").innerText()).slice(-4000))
    }
  throw error
} finally {
  await browser?.close()
  await server?.close()
  rmSync(root, { recursive: true, force: true })
}
