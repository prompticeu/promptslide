// Real Studio UI smoke test. Requires Chromium and local sockets, no external services.
import assert from "node:assert/strict"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve, join } from "node:path"
const { chromium } = createRequire(new URL("../../packages/cli/package.json", import.meta.url))(
  "playwright"
)

import { getCaptureServer } from "../../packages/cli/src/utils/export.mjs"
const cwd = resolve(import.meta.dirname, "../.."),
  out = join(import.meta.dirname, "results/production")
await mkdir(out, { recursive: true })
const server = process.env.PPTX_STUDIO_URL
  ? { baseUrl: process.env.PPTX_STUDIO_URL, close: async () => {} }
  : await getCaptureServer(cwd)
const browser = await chromium.launch({ executablePath: process.env.PPTX_BENCH_CHROMIUM })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true
})
const errors = []
const exports = []
page.on("request", request => {
  if (request.url().endsWith("/__promptslide_exports/pptx") && request.method() === "POST")
    exports.push(request.postDataJSON())
})
page.on("pageerror", error => errors.push(error.message))
try {
  await page.goto(server.baseUrl)
  const action = page.getByRole("button", { name: "Download", exact: true })
  await action.waitFor()
  await action.click()
  const menu = page.getByRole("menu", { name: "Download format" })
  const pptx = menu.getByRole("menuitem", { name: "PowerPoint (.pptx)", exact: true })
  await pptx.waitFor()
  assert.equal(await menu.getByRole("menuitem").count(), 2)
  await page.keyboard.press("End")
  assert.equal(await pptx.evaluate(e => e === e.getRootNode().activeElement), true)
  await page.keyboard.press("Escape")
  assert.equal(await action.evaluate(e => e === e.getRootNode().activeElement), true)
  await action.click()
  await page.locator("h1").first().click()
  assert.equal(await menu.count(), 0)
  await action.click()
  const pdfDownload = page.waitForEvent("download", { timeout: 120000 })
  await menu.getByRole("menuitem", { name: "PDF (.pdf)", exact: true }).click()
  const pdf = await pdfDownload
  await pdf.saveAs(join(out, "studio.pdf"))
  assert.equal((await readFile(join(out, "studio.pdf"))).subarray(0, 4).toString(), "%PDF")
  await page.evaluate(() =>
    sessionStorage.setItem("promptslide:editor-draft", JSON.stringify({ unsaved: true }))
  )
  await action.click()
  await pptx.click()
  const dialog = page.getByRole("dialog")
  await dialog.getByText("There are unsaved editor changes.").waitFor()
  assert.equal(await dialog.getByLabel("Conversion", { exact: true }).count(), 0)
  assert.equal(await dialog.getByRole("combobox").count(), 0, "Advanced options start collapsed")
  const revealOptions = dialog.getByText("Animation options", { exact: true })
  if (await revealOptions.count()) {
    await revealOptions.click()
    const reveal = dialog.getByLabel("Slide reveals", { exact: true })
    assert.match(await reveal.innerText(), /Show all content/)
    for (const label of [
      "One slide per reveal",
      "Animate reveals in PowerPoint",
      "Show all content"
    ]) {
      await reveal.click()
      await page.getByRole("option", { name: label, exact: true }).click()
      assert.match(await reveal.innerText(), new RegExp(label))
    }
    await revealOptions.click()
    assert.equal(await dialog.getByRole("combobox").count(), 0)
  }

  assert.equal(
    await dialog.getByRole("button", { name: "Export .pptx", exact: true }).isDisabled(),
    true
  )
  await dialog.getByRole("checkbox", { name: "Export the last saved version", exact: true }).check()
  const download = page.waitForEvent("download", { timeout: 120000 })
  await dialog.getByRole("button", { name: "Export .pptx", exact: true }).click()
  const file = await download
  await file.saveAs(join(out, "studio.pptx"))
  assert.deepEqual(exports[0], { mode: "balanced", buildMode: "final" })

  await dialog
    .getByRole("heading", { name: /PowerPoint exported|Exported with compatibility issues/ })
    .waitFor()
  const reportDownload = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "Download report" }).click()
  const reportFile = await reportDownload
  await dialog.getByRole("button", { name: "Export again" }).click()
  await dialog.getByRole("button", { name: "Cancel export" }).click()
  await dialog.getByRole("heading", { name: "Export cancelled", exact: true }).waitFor()
  await dialog.getByRole("button", { name: "Close export", exact: true }).click()
  assert.equal(await action.evaluate(e => e === e.getRootNode().activeElement), true)
  assert.deepEqual(errors, [])
  // Keep generated JSON out of the live watcher until interaction checks finish.
  await reportFile.saveAs(join(out, "studio.report.json"))
  await writeFile(
    join(out, "studio-qa.json"),
    JSON.stringify(
      {
        passed: true,
        checks: [
          "capability",
          "unified format menu",
          "menu keyboard navigation",
          "outside dismissal",
          "PDF download",
          "unsaved draft guard",
          "automatic conversion quality",
          "optional reveal controls",
          "default export payload",
          "download",
          "report",
          "cancel",
          "focus restoration"
        ],
        browser: browser.version(),
        url: server.baseUrl,
        errors
      },
      null,
      2
    ) + "\n"
  )
  console.log("Studio UI: all checks passed")
} catch (error) {
  await page.screenshot({ path: join(out, "studio-failure.png") }).catch(() => {})
  console.error(
    (
      await page
        .getByRole("dialog")
        .innerText()
        .catch(() => "No export dialog")
    ).slice(-2500)
  )
  throw error
} finally {
  await browser.close()
  await server.close()
}
