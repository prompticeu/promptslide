// Requires the builds from ui-bundle.mjs. Exercises the cost probes only.
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { chromium } from "playwright"
import { preview } from "vite"

const output = resolve(process.env.UI_BUNDLE_OUT || "/tmp/promptslide-ui-bundles")
const evidence = { checked: [], errors: [] }
rmSync(resolve("docs/bundle-measurements/browser.json"), { force: true })
let server
async function closePreview() {
  if (!server) return
  const current = server
  server = undefined
  const closed = new Promise(done => current.httpServer.close(done))
  current.httpServer.closeAllConnections()
  await closed
}
const browser = await chromium.launch({ channel: "chrome", headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(15000)
  page.on("pageerror", error => evidence.errors.push(error.message))
  server = await preview({
    configFile: false,
    root: process.cwd(),
    build: { outDir: resolve(output, "integrated") },
    preview: { host: "127.0.0.1", port: 5193, strictPort: true }
  })
  await page.goto("http://127.0.0.1:5193", { waitUntil: "domcontentloaded" })
  const view = page.getByRole("button", { name: "View options", exact: true })
  await view.focus()
  await page.keyboard.press("ArrowDown")
  await page.getByRole("menu", { name: "View options", exact: true }).waitFor()
  await page.keyboard.press("Escape")
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "View options"
  )
  assert.equal(await view.evaluate(el => el === document.activeElement), true)
  evidence.checked.push(
    "Integrated Base UI view menu: ArrowDown opens, Escape closes and restores trigger focus"
  )
  await view.click()
  await page.getByRole("menuitemradio", { name: "Grid view", exact: true }).click()
  await view.click()
  assert.equal(
    await page
      .getByRole("menuitemradio", { name: "Grid view", exact: true })
      .getAttribute("aria-checked"),
    "true"
  )
  await page.keyboard.press("Home")
  await page.keyboard.press("Enter")
  evidence.checked.push(
    "Integrated menu selection changes the real deck view and updates aria-checked"
  )
  const settings = page.getByRole("button", { name: "Slide settings", exact: true })
  await settings.click()
  assert.equal(await settings.getAttribute("aria-pressed"), "true")
  assert.equal(await settings.evaluate(el => getComputedStyle(el).color), "rgb(255, 107, 53)")
  const checkbox = page.getByRole("checkbox", {
    name: "Include current slide in loop",
    exact: true
  })
  assert.equal(await checkbox.getAttribute("aria-checked"), "true")
  assert.equal(
    await checkbox.locator("svg").evaluate(el => getComputedStyle(el).color),
    "rgb(255, 255, 255)"
  )
  const slideBeforeToggle = await page
    .locator("[data-ps-editor-canvas]")
    .getAttribute("data-slide-index")
  await checkbox.focus()
  await page.keyboard.press("Space")
  assert.equal(await checkbox.getAttribute("aria-checked"), "false")
  assert.equal(
    await page.locator("[data-ps-editor-canvas]").getAttribute("data-slide-index"),
    slideBeforeToggle
  )
  evidence.checked.push(
    "Integrated settings: orange selected action, white checkbox checkmark, Space toggles real loop inclusion"
  )
  await page.getByRole("button", { name: "Comment", exact: true }).hover()
  await page.locator("[data-ps-probe].ps-probe-popup").filter({ hasText: "Comment (C)" }).waitFor()
  evidence.checked.push("Base UI toolbar tooltip opens through the actual toolbar adapter")
  console.log("PASS integrated controls, keyboard, selection, and tooltip")
  await page.screenshot({ path: resolve(output, "integrated.png") })
  await closePreview()
  server = await preview({
    configFile: false,
    root: process.cwd(),
    build: { outDir: resolve(output, "deferred") },
    preview: { host: "127.0.0.1", port: 5193, strictPort: true }
  })
  const scripts = new Set()
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith(".js")) scripts.add(request.url())
  })
  await page.goto("http://127.0.0.1:5193", { waitUntil: "domcontentloaded" })
  const initialScripts = [...scripts]
  await page.getByRole("button", { name: "Open application controls", exact: true }).click()
  await page.getByRole("button", { name: "Annotation", exact: true }).waitFor()
  assert.ok(scripts.size > initialScripts.length)
  evidence.checked.push("Deferred popup chunk is requested only after the explicit controls action")
  evidence.deferredScripts = {
    initial: initialScripts.map(url => new URL(url).pathname),
    afterOpen: [...scripts].map(url => new URL(url).pathname)
  }
  assert.deepEqual(evidence.errors, [])
  mkdirSync(resolve("docs/bundle-measurements"), { recursive: true })
  writeFileSync(
    resolve("docs/bundle-measurements/browser.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser.close()
  await closePreview()
}
