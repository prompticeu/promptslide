// Controlled relative performance check; not a substitute for field Core Web Vitals.
import assert from "node:assert/strict"
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { resolve, extname, sep } from "node:path"
import { brotliCompressSync, constants } from "node:zlib"

import { chromium } from "playwright"

const directory = resolve(process.env.UI_MIGRATION_OUT || "/tmp/promptslide-application-bundles")
const servers = []
const browser = await chromium.launch({ headless: true, channel: "chrome" })
const results = {
  conditions: {
    viewport: "390x844, mobile/touch",
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadBytesPerSecond: 200 * 1024,
    uploadBytesPerSecond: 128 * 1024,
    compression: "Brotli quality 11, served over HTTP",
    cache: "fresh browser context and disabled HTTP cache for each sample",
    externalFonts: "font CSS fulfilled empty in both cases to isolate application JS/CSS",
    runs: 3
  },
  samples: {},
  median: {},
  errors: []
}
try {
  for (const [index, variant] of ["baseline", "migration"].entries()) {
    const root = resolve(directory, variant),
      cache = new Map()
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      const file = resolve(root, "." + (path === "/" ? "/index.html" : path))
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
        res.statusCode = 404
        res.end()
        return
      }
      if (!cache.has(file))
        cache.set(
          file,
          brotliCompressSync(readFileSync(file), {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
          })
        )
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png"
        }[extname(file)] ?? "application/octet-stream"
      )
      res.setHeader("Content-Encoding", "br")
      res.setHeader("Cache-Control", "no-store")
      res.end(cache.get(file))
    })
    servers.push(server)
    await new Promise(ready => server.listen(5196 + index, "127.0.0.1", ready))
    // Precompress outside the measured navigation; a server's compression CPU
    // should not be attributed to client startup in this relative comparison.
    const manifest = JSON.parse(readFileSync(resolve(root, ".vite/manifest.json"), "utf8"))
    for (const item of Object.values(manifest))
      for (const file of [item.file, ...(item.css ?? [])]) {
        const path = resolve(root, file)
        if (existsSync(path) && !cache.has(path))
          cache.set(
            path,
            brotliCompressSync(readFileSync(path), {
              params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
            })
          )
      }
    cache.set(
      resolve(root, "index.html"),
      brotliCompressSync(readFileSync(resolve(root, "index.html")), {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
      })
    )
    results.samples[variant] = []
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1
      })
      await context.route("https://fonts.googleapis.com/**", route =>
        route.fulfill({ contentType: "text/css", body: "" })
      )
      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      page.on("pageerror", error => results.errors.push(`${variant}: ${error.message}`))
      const cdp = await context.newCDPSession(page)
      await cdp.send("Network.enable")
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200 * 1024,
        uploadThroughput: 128 * 1024,
        connectionType: "cellular4g"
      })
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
      await cdp.send("Performance.enable")
      await page.goto(`http://127.0.0.1:${5196 + index}`, { waitUntil: "domcontentloaded" })
      await page.locator("[data-ps-editor-canvas] h1").first().waitFor()
      const view = page.getByRole("button", { name: "View options", exact: true })
      await view.waitFor()
      const initial = await page.evaluate(() => ({
        startupMs: performance.now(),
        encodedJsCss: performance
          .getEntriesByType("resource")
          .filter(e => /\.(js|css)(\?|$)/.test(e.name))
          .reduce((n, e) => n + e.encodedBodySize, 0)
      }))
      const { metrics } = await cdp.send("Performance.getMetrics")
      const scriptMs = metrics.find(item => item.name === "ScriptDuration").value * 1000
      const menuStart = await page.evaluate(() => performance.now())
      await view.tap()
      await page.getByRole("menu", { name: "View options", exact: true }).waitFor()
      const firstMenuMs = (await page.evaluate(() => performance.now())) - menuStart
      await page.keyboard.press("Escape")
      const settingsStart = await page.evaluate(() => performance.now())
      await page.getByRole("button", { name: "Slide settings", exact: true }).tap()
      await page.getByRole("region", { name: "Slide settings", exact: true }).waitFor()
      const firstSettingsMs = (await page.evaluate(() => performance.now())) - settingsStart
      const sample = { run: run + 1, ...initial, scriptMs, firstMenuMs, firstSettingsMs }
      results.samples[variant].push(sample)
      console.log(variant, JSON.stringify(sample))
      await context.close()
    }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  for (const variant of ["baseline", "migration"])
    results.median[variant] = Object.fromEntries(
      ["startupMs", "encodedJsCss", "scriptMs", "firstMenuMs", "firstSettingsMs"].map(key => [
        key,
        +median(results.samples[variant].map(sample => sample[key])).toFixed(1)
      ])
    )
  assert.deepEqual(results.errors, [])
  // Generous usability guardrails for this deliberately throttled desktop run.
  assert.ok(results.median.migration.startupMs < 6000, "Cold mobile startup exceeded 6s")
  assert.ok(results.median.migration.firstMenuMs < 1500, "First deferred menu exceeded 1.5s")
  assert.ok(results.median.migration.firstSettingsMs < 1500, "First settings panel exceeded 1.5s")
  writeFileSync(
    resolve("docs/bundle-measurements/performance.json"),
    JSON.stringify(results, null, 2) + "\n"
  )
  console.log(JSON.stringify(results.median, null, 2))
} finally {
  await browser.close()
  for (const server of servers) {
    const closed = new Promise(done => server.close(done))
    server.closeAllConnections()
    await closed
  }
}
