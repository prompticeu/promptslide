// Localize Chromium's gradient-text soft masks to avoid viewer-specific clipping.
export async function normalizePdfTextPaint(page, index, onIssue) {
  const targets = await page.evaluate(
    active => window.__promptslidePdf.paint.gradientTextTargets(active),
    index
  )
  const scale = await page.evaluate(() => window.devicePixelRatio)
  for (const target of targets) {
    let paint
    try {
      await page.evaluate(
        ({ active, id }) => window.__promptslidePdf.paint.isolateGradientText(active, id),
        { active: index, id: target.id }
      )
      const png = await page.screenshot({ type: "png", omitBackground: true, scale: "device" })
      paint = await page.evaluate(
        ({ data, pixelScale }) => window.__promptslidePdf.paint.cropTextPaint(data, pixelScale),
        { data: `data:image/png;base64,${png.toString("base64")}`, pixelScale: scale }
      )
    } finally {
      await page.evaluate(() => window.__promptslidePdf.paint.restoreGradientText())
    }
    if (!paint) continue
    await page.evaluate(
      ({ active, id, capture }) =>
        window.__promptslidePdf.paint.replaceGradientText(active, id, capture),
      { active: index, id: target.id, capture: paint }
    )
    onIssue({
      code: "PDF_GRADIENT_TEXT_GRAPHIC",
      severity: "info",
      message:
        "Gradient text paint uses a localized high-resolution graphic for PDF viewer compatibility; underlying text remains selectable.",
      page: index + 1,
      characters: target.text.length
    })
  }
}
