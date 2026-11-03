// Keep transient web-font failures from silently changing slide layout. Retries
// happen before Chromium sees a failed response, so fonts are loaded before the
// existing measurement/actual-face discovery and font-byte capture.
export async function installFontRetries(page, onIssue = () => {}, onFont = async () => {}) {
  await page.route("**/*", async route => {
    const request = route.request()
    if (!["font", "stylesheet"].includes(request.resourceType())) return route.continue()
    const kind = request.resourceType() === "font" ? "FONT" : "STYLESHEET"
    const label = kind === "FONT" ? "web font" : "stylesheet"
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await route.fetch({ timeout: 8000 })
        const status = response.status()
        if (attempt === 0 && [408, 429, 500, 502, 503, 504].includes(status)) {
          const retryAfter = response.headers()["retry-after"]
          if (!retryAfter || (/^\d+$/.test(retryAfter) && Number(retryAfter) <= 1)) {
            await new Promise(resolve =>
              setTimeout(resolve, retryAfter ? Number(retryAfter) * 1000 : 150)
            )
            continue
          }
        }
        if (!response.ok())
          onIssue({
            code: `${kind}_DOWNLOAD_FAILED`,
            severity: "warning",
            message: `A ${label} could not be downloaded (HTTP ${status}). The slide appearance may be affected.`
          })
        else if (attempt)
          onIssue({
            code: `${kind}_DOWNLOAD_RECOVERED`,
            severity: "info",
            message: `A transient ${label} request failed and was recovered before measuring the slides.`
          })
        // Make captured bytes available before Chromium can finish loading the
        // face. Response events for fulfilled routes can arrive after layout.
        if (kind === "FONT" && response.ok()) await onFont(response, request.url())
        return await route.fulfill({ response })
      } catch {
        if (page.isClosed()) return
      }
    }
    onIssue({
      code: `${kind}_DOWNLOAD_FAILED`,
      severity: "warning",
      message: `A ${label} could not be downloaded after two attempts. The slide appearance may be affected.`
    })
    await route.abort("failed").catch(() => {})
  })
}
