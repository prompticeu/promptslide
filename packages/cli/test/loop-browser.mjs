// Run explicitly: node packages/cli/test/loop-browser.mjs
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"
import { createServer, preview } from "vite"

import { build } from "../src/commands/build.mjs"
import { createViteConfig } from "../src/vite/config.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const root = mkdtempSync(join(tmpdir(), "promptslide-loop-browser-"))
const errors = []
let studio, production, browser
const config = {
  version: 1,
  defaultDuration: 0.3,
  slides: {
    a: { steps: 2, dwell: [0.25, 0.4, 0.6] },
    skip: { excluded: true },
    b: { dwell: [0.3] }
  }
}
try {
  mkdirSync(join(root, "src"))
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"), "dir")
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }))
  writeFileSync(
    join(root, "src/globals.css"),
    `@import "tailwindcss";\n@source "${repo}/packages/cli/src/core";\nhtml,body { margin:0; background:#111; color:white; }`
  )
  writeFileSync(
    join(root, "src/deck-config.ts"),
    `import type { SlideConfig } from "promptslide"\nexport const slides: SlideConfig[] = []`
  )
  writeFileSync(
    join(root, "src/App.tsx"),
    `
import { useEffect, useState } from "react"
import { SlideDeck, useAnimationContext } from "promptslide"
function A() {
  const { currentStep } = useAnimationContext()
  const [born] = useState(() => performance.now())
  useEffect(() => { window.__mounts = (window.__mounts || 0) + 1 }, [])
  return <div data-active="a" data-step={currentStep} data-born={born}><h1>Agents heading</h1><p>Agents {currentStep}</p></div>
}
function B() { const [born] = useState(() => performance.now()); return <div data-active="b" data-step="0" data-born={born}>Outro</div> }
function Skip() { return <div data-active="skip">Excluded</div> }
const slides = [{id:"a",title:"Agents",component:A,steps:2},{id:"skip",title:"Skip",component:Skip,steps:0},{id:"b",title:"Outro",component:B,steps:0}]
const hostConfig = ${JSON.stringify(config)}
export default function App() {
  const [, setRevision] = useState(0)
  const [defaultDuration, setDefaultDuration] = useState(hostConfig.defaultDuration)
  useEffect(() => {
    window.__rerender = () => setRevision(value => value + 1)
    window.__setHostDuration = setDefaultDuration
  }, [])
  const sdk = new URLSearchParams(location.search).has("sdk")
  return <SlideDeck slides={slides} loopConfig={sdk ? { ...hostConfig, defaultDuration, slides: { ...hostConfig.slides } } : undefined} />
}
`
  )
  writeFileSync(join(root, "src/theme.ts"), "export const theme = {}\n")
  writeFileSync(join(root, "loop-config.json"), JSON.stringify(config))
  studio = await createServer({
    ...createViteConfig({ cwd: root }),
    server: { host: "127.0.0.1", port: 0 }
  })
  await studio.listen()
  const studioUrl = studio.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: "chrome" })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(studioUrl)
  // One inspector owns all panels; leaving the editor respects its draft guard.
  const inspector = page.getByRole("complementary", { name: "Inspector", exact: true })
  const editor = page.getByRole("complementary", { name: "Format panel", exact: true })
  await page.getByRole("button", { name: "Edit slide", exact: true }).click()
  await editor.waitFor()
  assert.equal(await page.getByRole("button", { name: "Present", exact: true }).isDisabled(), true)
  assert.equal(
    await page.getByRole("button", { name: "Presentation options", exact: true }).isDisabled(),
    true
  )
  await page.locator("[data-ps-editor-canvas] h1").click()
  await editor.getByLabel("Text", { exact: true }).fill("Discarded heading")
  await inspector.getByRole("tab", { name: "Slide", exact: true }).click()
  const confirm = page.getByRole("dialog", { name: "Save your changes?" })
  await confirm.getByRole("button", { name: "Keep editing", exact: true }).click()
  assert.equal(
    await inspector
      .getByRole("tab", { name: "Elements", exact: true })
      .getAttribute("aria-selected"),
    "true"
  )
  assert.equal(await editor.getByLabel("Text", { exact: true }).inputValue(), "Discarded heading")
  // Cancelling a requested tab switch must not leave a queued destination behind.
  await page.getByRole("button", { name: "Done editing", exact: true }).click()
  await confirm.getByRole("button", { name: "Discard changes", exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector("[data-ps-inspector]")?.getAttribute("aria-hidden") === "true"
  )
  await page.getByRole("button", { name: "Presentation options" }).click()
  await page.getByRole("button", { name: "Configure loop…" }).click()
  await page.getByRole("region", { name: "Slide settings", exact: true }).waitFor()
  assert.equal(await page.getByRole("dialog").count(), 0)
  assert.equal(await page.getByLabel("Default duration in seconds").inputValue(), "0.3")
  await page.getByRole("button", { name: "Step 2", exact: true }).click()
  assert.equal(await page.getByLabel("Step 2 duration in seconds").inputValue(), "0.6")
  assert.equal(
    await page.locator('[data-ps-editor-canvas] [data-active="a"]').getAttribute("data-step"),
    "2"
  )
  await page.getByLabel("Step 2 duration in seconds").fill("0.7")
  await page.getByLabel("Step 2 duration in seconds").press("Tab")
  await page.getByRole("button", { name: "Go to slide 3: Outro", exact: true }).click()
  await page.getByRole("heading", { name: "Outro", exact: true }).waitFor()
  await page.getByRole("button", { name: "Go to slide 1: Agents", exact: true }).click()
  await page.getByRole("heading", { name: "Agents", exact: true }).waitFor()
  assert.equal(await page.getByLabel("Step 2 duration in seconds").inputValue(), "0.7")
  // The existing next arrow and timing rows share the same current step.
  await page.getByTitle("Next step or slide (→ / Space)").click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-ps-editor-canvas] [data-active="a"]')
        ?.getAttribute("data-step") === "1"
  )
  assert.equal(
    await page.getByRole("button", { name: "Step 1", exact: true }).getAttribute("aria-pressed"),
    "true"
  )
  // Saving source changes while switching tabs preserves timing drafts.
  await inspector.getByRole("tab", { name: "Elements", exact: true }).click()
  await page.locator("[data-ps-editor-canvas] h1").click()
  await editor.getByLabel("Text", { exact: true }).fill("Saved inspector heading")
  await inspector.getByRole("tab", { name: "Comments", exact: true }).click()
  await confirm.getByRole("button", { name: "Save changes", exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === "Comments"
  )
  assert.match(readFileSync(join(root, "src/App.tsx"), "utf8"), /Saved inspector heading/)
  await inspector.getByRole("tab", { name: "Slide", exact: true }).click()
  assert.equal(await page.getByLabel("Step 2 duration in seconds").inputValue(), "0.7")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await page.getByText("Saved to loop-config.json.", { exact: false }).waitFor()
  assert.equal(
    JSON.parse(readFileSync(join(root, "loop-config.json"), "utf8")).slides.a.dwell[2],
    0.7
  )
  // Unedited states inherit the default after overriding another state.
  await page.getByRole("button", { name: "Go to slide 3: Outro", exact: true }).click()
  await page.getByRole("button", { name: "Use default for this slide", exact: true }).click()
  await page.getByLabel("Default duration in seconds").fill("0.4")
  await page.getByLabel("Default duration in seconds").press("Tab")
  assert.equal(await page.getByLabel("Initial view duration in seconds").inputValue(), "0.4")
  await page.getByLabel("Default duration in seconds").fill("0.3")
  await page.getByLabel("Default duration in seconds").press("Tab")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await page.getByText("Saved to loop-config.json.", { exact: false }).waitFor()
  // Merely focusing a duration must not turn an inherited value into an override.
  await page.getByLabel("Initial view duration in seconds").focus()
  await page.getByRole("button", { name: "Initial view", exact: true }).click()
  assert.equal(await page.getByText("Default duration", { exact: true }).isVisible(), true)
  assert.equal(await page.getByText("Unsaved loop settings", { exact: true }).count(), 0)
  // Shared chrome supports keyboard tab selection without advancing the slide.
  const slideTab = inspector.getByRole("tab", { name: "Slide", exact: true })
  await slideTab.focus()
  await slideTab.press("End")
  await page.keyboard.press("Enter")
  assert.equal(
    await inspector
      .getByRole("tab", { name: "Comments", exact: true })
      .getAttribute("aria-selected"),
    "true"
  )
  await slideTab.click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: "/tmp/promptslide-loop-settings.png" })
  await page.getByRole("button", { name: "Close slide settings" }).click()
  // A fresh Studio tab sees saved settings without restarting the server.
  const fresh = await browser.newPage()
  await fresh.goto(studioUrl)
  await fresh.getByRole("button", { name: "Presentation options" }).click()
  await fresh.getByRole("button", { name: "Configure loop…" }).click()
  await fresh.getByRole("button", { name: "Step 2", exact: true }).click()
  assert.equal(await fresh.getByLabel("Step 2 duration in seconds").inputValue(), "0.7")
  await fresh.close()
  // A blur without a new focus target must not remove menu options before click.
  await page.getByRole("button", { name: "View options", exact: true }).click()
  await page.evaluate(() => document.activeElement.blur())
  assert.equal(await page.getByRole("menu", { name: "View options" }).isVisible(), true)
  await page.getByRole("menuitemradio", { name: "List view", exact: true }).click()
  assert.match(
    await page.getByRole("button", { name: "View options" }).getAttribute("title"),
    /List view/
  )
  await page.getByRole("button", { name: "View options", exact: true }).click()
  await page.getByRole("button", { name: "Comment", exact: true }).focus()
  assert.equal(await page.getByRole("menu", { name: "View options" }).count(), 0)
  await page.getByRole("button", { name: "View options", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Presentation view", exact: true }).click()
  await page.getByRole("button", { name: "View options", exact: true }).click()
  await page.evaluate(() => document.activeElement.blur())
  await page.getByRole("button", { name: "View options", exact: true }).click()
  assert.equal(await page.getByRole("menu", { name: "View options" }).count(), 0)

  // SDK hosts often construct equivalent config objects on every parent render.
  const sdk = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  sdk.on("pageerror", error => errors.push(error.message))
  await sdk.goto(studioUrl + "?sdk")
  await sdk.getByRole("button", { name: "Slide settings", exact: true }).click()
  const sdkDuration = sdk.getByLabel("Initial view duration in seconds")
  await sdkDuration.fill("1.2")
  await sdkDuration.press("Tab")
  await sdk.evaluate(() => window.__rerender())
  await sdk.waitForTimeout(100)
  assert.equal(await sdkDuration.inputValue(), "1.2")
  assert.equal(await sdk.getByText("Unsaved loop settings", { exact: true }).isVisible(), true)
  const projectFile = readFileSync(join(root, "loop-config.json"), "utf8")
  const storageBefore = await sdk.evaluate(() => JSON.stringify(localStorage))
  await sdk.getByRole("button", { name: "Start loop", exact: true }).click()
  await sdk.locator('[data-loop-running="true"]').waitFor()
  await sdk.keyboard.press("Space")
  await sdk.getByText("Loop paused", { exact: false }).waitFor()
  await sdk.evaluate(() => window.__rerender())
  await sdk.waitForTimeout(100)
  assert.equal(await sdk.locator('[data-loop-running="true"]').count(), 1)
  assert.equal(await sdk.getByText("Loop paused", { exact: false }).isVisible(), true)
  await sdk.keyboard.press("Escape")
  await sdk.waitForFunction(() => !document.fullscreenElement)
  await sdk.getByRole("button", { name: "Slide settings", exact: true }).click()
  assert.equal(await sdkDuration.inputValue(), "1.2")
  await sdk.getByText("Unsaved loop settings", { exact: true }).waitFor()
  assert.equal(await sdk.evaluate(() => JSON.stringify(localStorage)), storageBefore)
  assert.equal(readFileSync(join(root, "loop-config.json"), "utf8"), projectFile)
  await sdk.getByRole("button", { name: "Revert", exact: true }).click()
  assert.equal(await sdkDuration.inputValue(), "0.25")
  // A real configuration change still replaces stale drafts.
  await sdkDuration.fill("0.8")
  await sdkDuration.press("Tab")
  await sdk.evaluate(() => window.__setHostDuration(0.9))
  await sdk.waitForFunction(
    () => document.querySelector('[aria-label="Default duration in seconds"]')?.value === "0.9"
  )
  assert.equal(await sdkDuration.inputValue(), "0.25")
  assert.equal(await sdk.getByText("Unsaved loop settings", { exact: true }).count(), 0)
  // A rejected project save must also preserve the saved baseline and browser storage.
  await sdkDuration.fill("0.8")
  await sdkDuration.press("Tab")
  await sdk.route("**/__promptslide_loop", route => route.fulfill({ status: 500 }))
  await Promise.all([
    sdk.waitForResponse(response => response.url().endsWith("/__promptslide_loop")),
    sdk.getByRole("button", { name: "Save settings", exact: true }).click()
  ])
  assert.equal(await sdk.getByText("Unsaved loop settings", { exact: true }).isVisible(), true)
  assert.equal(await sdk.evaluate(() => JSON.stringify(localStorage)), storageBefore)
  assert.equal(readFileSync(join(root, "loop-config.json"), "utf8"), projectFile)
  await sdk.getByRole("button", { name: "Revert", exact: true }).click()
  assert.equal(await sdkDuration.inputValue(), "0.25")
  await sdk.close()
  await page.close()
  await studio.close()
  studio = undefined
  // Build uses the saved file, independently of this browser's local storage.
  const previousDirectory = process.cwd()
  process.chdir(root)
  try {
    await build([])
  } finally {
    process.chdir(previousDirectory)
  }
  production = await preview({ configFile: false, root, preview: { host: "127.0.0.1", port: 0 } })
  const productionUrl = production.resolvedUrls.local[0]
  const playback = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  playback.on("pageerror", error => errors.push(error.message))
  await playback.addInitScript(() => {
    window.__states = []
    let previous = ""
    new MutationObserver(() => {
      const canvas = document.querySelector('[data-loop-running="true"]')
      if (!canvas) return
      const item = [...canvas.querySelectorAll("[data-active]")].at(-1)
      if (!item) return
      const state = item.dataset.active + ":" + item.dataset.step
      if (state !== previous) {
        previous = state
        window.__states.push({ state, at: performance.now() })
      }
    }).observe(document, { subtree: true, childList: true, attributes: true })
  })
  await playback.goto(productionUrl + "?loop")
  await playback.getByRole("button", { name: "Click to start" }).click()
  await playback.waitForFunction(() => document.fullscreenElement)
  await playback.waitForFunction(
    () => window.__states.filter(s => s.state === "b:0").length >= 3,
    null,
    { timeout: 15000 }
  )
  const states = await playback.evaluate(() => window.__states)
  assert.ok(!states.some(s => s.state.startsWith("skip")))
  const first = states.findIndex(s => s.state === "a:0")
  assert.deepEqual(
    states.slice(first, first + 8).map(s => s.state),
    ["a:0", "a:1", "a:2", "b:0", "a:0", "a:1", "a:2", "b:0"]
  )
  const elapsed = states[first + 3].at - states[first + 2].at
  assert.ok(elapsed >= 650 && elapsed < 1600, `Final state duration: ${elapsed}ms`)
  await playback.keyboard.press("Space")
  await playback.getByText("Loop paused", { exact: false }).waitFor()
  const count = await playback.evaluate(() => window.__states.length)
  await playback.waitForTimeout(800)
  assert.equal(await playback.evaluate(() => window.__states.length), count)
  await playback.keyboard.press("Space")
  await playback.waitForFunction(priorCount => window.__states.length > priorCount, count)
  // Hidden tabs pause rather than accumulating timer ticks.
  await playback.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const hiddenCount = await playback.evaluate(() => window.__states.length)
  await playback.waitForTimeout(800)
  assert.equal(await playback.evaluate(() => window.__states.length), hiddenCount)
  await playback.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await playback.waitForFunction(priorCount => window.__states.length > priorCount, hiddenCount)
  await playback.keyboard.press("Escape")
  await playback.waitForFunction(() => !document.fullscreenElement)
  const stopped = await playback.evaluate(() => window.__states.length)
  await playback.waitForTimeout(700)
  assert.equal(await playback.evaluate(() => window.__states.length), stopped)
  // Configure a one-slide loop and verify a new component instance each cycle.
  await playback.getByRole("button", { name: "Presentation options" }).click()
  await playback.getByRole("button", { name: "Configure loop…" }).click()
  await playback.getByRole("button", { name: "Go to slide 3: Outro", exact: true }).click()
  await playback.getByLabel("Include current slide in loop").uncheck()
  await playback.getByRole("button", { name: "Start loop", exact: true }).click()
  const mounted = await playback.evaluate(() => window.__mounts)
  await playback.waitForFunction(priorMounts => window.__mounts > priorMounts + 2, mounted, {
    timeout: 6000
  })
  await playback.keyboard.press("Escape")
  await playback.waitForFunction(() => !document.fullscreenElement)
  // A one-slide loop without click steps also remounts on every cycle.
  await playback.getByRole("button", { name: "Presentation options" }).click()
  await playback.getByRole("button", { name: "Configure loop…" }).click()
  await playback.getByRole("button", { name: "Go to slide 1: Agents", exact: true }).click()
  await playback.getByLabel("Include current slide in loop").uncheck()
  await playback.getByRole("button", { name: "Go to slide 3: Outro", exact: true }).click()
  await playback.getByLabel("Include current slide in loop").check()
  await playback.getByRole("button", { name: "Start loop", exact: true }).click()
  await playback.waitForTimeout(400)
  const born = await playback
    .locator('[data-loop-running="true"] [data-active="b"]')
    .getAttribute("data-born")
  await playback.waitForTimeout(700)
  assert.notEqual(
    await playback
      .locator('[data-loop-running="true"] [data-active="b"]')
      .getAttribute("data-born"),
    born
  )
  await playback.keyboard.press("Escape")
  await playback.waitForFunction(() => !document.fullscreenElement)
  // Static save offers truthful browser-only persistence.
  await playback.getByRole("button", { name: "Presentation options" }).click()
  await playback.getByRole("button", { name: "Configure loop…" }).click()
  await playback.getByRole("button", { name: "Save settings", exact: true }).click()
  await playback.getByText("Saved in this browser.", { exact: false }).waitFor()
  await playback.getByRole("button", { name: "Close slide settings" }).click()
  // A denied fullscreen request leaves the player stopped and retryable.
  await playback.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(new Error("Denied"))
  })
  await playback.getByRole("button", { name: "Presentation options" }).click()
  await playback.getByRole("button", { name: "Auto-loop", exact: true }).click()
  await playback.getByRole("alert").filter({ hasText: "Full screen could not start" }).waitFor()
  assert.equal(await playback.locator('[data-loop-running="true"]').count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      result: "passed",
      cycles: 3,
      measuredFinalStateMs: Math.round(elapsed),
      sharedInspector: true,
      guardedPanelSwitch: true,
      timingDraftPreserved: true,
      studioSave: true,
      production: true,
      pause: true,
      hiddenTab: true,
      escape: true,
      singleSlideRestart: true,
      errors
    })
  )
} catch (error) {
  for (const context of browser?.contexts() || []) {
    for (const page of context.pages()) {
      await page.screenshot({ path: "/tmp/promptslide-inspector-failure.png" }).catch(() => {})
      console.error(
        (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(-3000)
      )
    }
  }
  throw error
} finally {
  await browser?.close()
  await studio?.close()
  await production?.close()
  rmSync(root, { recursive: true, force: true })
}
