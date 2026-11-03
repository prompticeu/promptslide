import assert from "node:assert/strict"
import { resolve } from "node:path"

import { chromium } from "playwright"

import { getCaptureServer } from "../../packages/cli/src/utils/export.mjs"
const server = await getCaptureServer(resolve(import.meta.dirname, "../.."))
const browser = await chromium.launch({ executablePath: process.env.PPTX_BENCH_CHROMIUM })
const page = await browser.newPage()
let status = 500,
  release
const gate = new Promise(done => {
  release = done
})
await page.route("**/__promptslide_pdf", async route => {
  if (status === 500) await gate
  await route.fulfill({
    status,
    body: status === 500 ? "A slide image could not be loaded." : "Not found"
  })
})
try {
  await page.goto(server.baseUrl)
  await page.evaluate(() => {
    window.printCalls = 0
    window.print = () => {
      window.printCalls++
      window.dispatchEvent(new Event("afterprint"))
    }
  })
  const button = page.getByRole("button", { name: "Download", exact: true })
  await button.click()
  await page.getByRole("menuitem", { name: "PDF (.pdf)", exact: true }).click()
  await page.getByRole("status").filter({ hasText: "Preparing PDF…" }).waitFor()
  assert.equal(await button.isDisabled(), true)
  release()
  const alert = page.getByRole("alert")
  await alert.getByText("A slide image could not be loaded.").waitFor()
  assert.equal(await page.evaluate(() => window.printCalls), 0)
  assert.equal(await button.isDisabled(), false)
  await alert.getByRole("button", { name: "Dismiss" }).click()
  assert.equal(await alert.count(), 0)
  status = 404
  await button.click()
  await page.getByRole("menuitem", { name: "PDF (.pdf)", exact: true }).click()
  await page.waitForFunction(() => window.printCalls === 1)
  assert.equal(await alert.count(), 0)
  console.log(
    "PDF UI: busy state, visible server failure, no silent print, static print fallback passed"
  )
} finally {
  release()
  await browser.close()
  await server.close()
}
