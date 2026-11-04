// Cancellation must own its request even before POST completes or during download.
import assert from "node:assert/strict"
import { resolve } from "node:path"

import { chromium } from "playwright"

import { getCaptureServer } from "../../packages/cli/src/utils/export.mjs"
const server = await getCaptureServer(resolve(import.meta.dirname, "../.."))
const browser = await chromium.launch({ executablePath: process.env.PPTX_BENCH_CHROMIUM })
const page = await browser.newPage({ acceptDownloads: true })
let posts = 0,
  deletes = 0,
  polls = 0,
  downloads = 0,
  releasePost,
  releaseFile
const postGate = new Promise(done => {
  releasePost = done
})
const fileGate = new Promise(done => {
  releaseFile = done
})
page.on("download", () => downloads++)
await page.route("**/__promptslide_exports**", async route => {
  const path = new URL(route.request().url()).pathname
  if (path === "/__promptslide_exports")
    return route.fulfill({ json: { supported: true, token: "test" } })
  if (route.request().method() === "POST") {
    const id = ++posts
    if (id === 1) await postGate
    return route.fulfill({ json: { jobId: `job-${id}` } })
  }
  if (route.request().method() === "DELETE") {
    deletes++
    return route.fulfill({ status: 204 })
  }
  if (path.endsWith("/file")) {
    if (path.includes("job-2")) await fileGate
    return route.fulfill({
      body: "pptx-test",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    })
  }
  polls++
  return route.fulfill({
    json: { jobId: path.split("/").at(-1), status: "succeeded", hasFile: true, issues: [] }
  })
})
try {
  await page.goto(server.baseUrl)
  await page.getByRole("button", { name: "Download", exact: true }).click()
  await page.getByRole("menuitem", { name: "PowerPoint (.pptx)", exact: true }).click()
  const dialog = page.getByRole("dialog")
  const postRequest = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/pptx"))
  await dialog.getByRole("button", { name: "Export .pptx", exact: true }).click()
  await postRequest
  await dialog.getByRole("button", { name: "Cancel export", exact: true }).click()
  await dialog.getByRole("heading", { name: "Cancelling export…", exact: true }).waitFor()
  assert.equal(await dialog.getByRole("button", { name: /Retry|Export again/ }).count(), 0)
  assert.equal(
    await dialog.getByRole("button", { name: "Cancelling…", exact: true }).isDisabled(),
    true
  )
  releasePost()
  await dialog.getByRole("heading", { name: "Export cancelled", exact: true }).waitFor()
  assert.equal(deletes, 1)
  assert.equal(polls, 0)
  assert.equal(downloads, 0)
  const fileRequest = page.waitForRequest(r => r.url().endsWith("/job-2/file"))
  await dialog.getByRole("button", { name: /Try again|Export again|Retry|Export .pptx/ }).click()
  await fileRequest
  await dialog.getByRole("button", { name: "Cancel export", exact: true }).click()
  await dialog.getByRole("heading", { name: "Export cancelled", exact: true }).waitFor()
  releaseFile()
  const download = page.waitForEvent("download")
  await dialog.getByRole("button", { name: /Try again|Export again|Retry|Export .pptx/ }).click()
  await download
  await dialog.getByRole("heading", { name: "PowerPoint exported", exact: true }).waitFor()
  assert.equal(posts, 3)
  assert.equal(deletes, 2)
  assert.equal(downloads, 1, "Only the third, uncancelled operation downloads")
  console.log("Cancellation: delayed creation, delayed file, and clean retry passed")
} finally {
  releasePost()
  releaseFile()
  await browser.close()
  await server.close()
}
