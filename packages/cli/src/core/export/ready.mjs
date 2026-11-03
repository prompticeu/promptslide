// Browser-side readiness for a deterministic PDF still, including offscreen pages.
export async function preparePdfDocument(root) {
  const frame = () => new Promise(done => requestAnimationFrame(done))
  await frame()
  await frame()
  const failedSlide = root.querySelector("[data-slide-error]")
  if (failedSlide) throw new Error(failedSlide.getAttribute("data-slide-error") || "Slide failed")

  const fonts = new Map()
  const images = new Set()
  for (const element of [root, ...root.querySelectorAll("*")]) {
    const css = getComputedStyle(element)
    if (css.display === "none" || css.visibility !== "visible" || !element.getClientRects().length)
      continue
    if ([...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) {
      const descriptor = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`
      fonts.set(descriptor, (fonts.get(descriptor) || "") + element.textContent)
    }
    for (const paint of [css.backgroundImage, css.maskImage, css.borderImageSource])
      for (const match of paint.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) {
        const url = match[1] ?? match[2] ?? match[3]
        if (url && !url.startsWith("#")) images.add(url)
      }
    if (element instanceof SVGImageElement) {
      const url = element.href.baseVal
      if (url && !url.startsWith("#")) images.add(url)
    }
  }
  await Promise.all([...fonts].map(([descriptor, text]) => document.fonts.load(descriptor, text)))
  await document.fonts.ready
  await Promise.all(
    [...root.querySelectorAll("img")].map(async image => {
      if (!image.getClientRects().length || getComputedStyle(image).visibility !== "visible") return
      image.loading = "eager"
      try {
        await image.decode()
      } catch {
        throw new Error("A slide image could not be loaded. Check its source before exporting.")
      }
    })
  )
  await Promise.all(
    [...images].map(async url => {
      const image = new Image()
      image.src = url
      try {
        await image.decode()
      } catch {
        throw new Error(
          "A slide background or SVG image could not be loaded. Check its source before exporting."
        )
      }
    })
  )
  for (const animation of document.getAnimations()) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish()
    else {
      animation.pause()
      animation.currentTime = 0
    }
  }
  await frame()
  await frame()
}
