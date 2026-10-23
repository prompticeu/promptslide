export const DEFAULT_LOOP_CONFIG = { version: 1, defaultDuration: 5, slides: {} }

export function validateLoopConfig(value) {
  if (
    !value ||
    value.version !== 1 ||
    !validDuration(value.defaultDuration) ||
    !value.slides ||
    typeof value.slides !== "object" ||
    Array.isArray(value.slides)
  ) {
    throw new Error("Invalid loop settings")
  }
  const slides = Object.create(null)
  if (Object.keys(value.slides).length > 1000) throw new Error("Too many slides")
  for (const [id, item] of Object.entries(value.slides)) {
    if (
      !id ||
      id.length > 256 ||
      !item ||
      typeof item !== "object" ||
      (item.excluded !== undefined && typeof item.excluded !== "boolean") ||
      (item.steps !== undefined &&
        (!Number.isInteger(item.steps) || item.steps < 0 || item.steps > 1000)) ||
      (item.dwell !== undefined &&
        (!Array.isArray(item.dwell) ||
          item.dwell.length > 1001 ||
          !item.dwell.every(duration => duration === null || validDuration(duration))))
    )
      throw new Error(`Invalid timing for ${id}`)
    slides[id] = {
      ...(item.excluded !== undefined ? { excluded: item.excluded } : {}),
      ...(item.steps !== undefined ? { steps: item.steps } : {}),
      ...(item.dwell !== undefined ? { dwell: [...item.dwell] } : {})
    }
  }
  return { version: 1, defaultDuration: value.defaultDuration, slides }
}

export function validDuration(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.1 && value <= 3600
}

export function loopSlideKey(slide, index) {
  return slide.id || String(index + 1)
}

export function stateDuration(config, slide, index, step) {
  return config.slides[loopSlideKey(slide, index)]?.dwell?.[step] ?? config.defaultDuration
}

export function includedSlides(config, slides) {
  return slides.flatMap((slide, index) =>
    config.slides[loopSlideKey(slide, index)]?.excluded ? [] : [index]
  )
}

export function loopDuration(config, slides) {
  return includedSlides(config, slides).reduce((total, index) => {
    const slide = slides[index]
    for (let step = 0; step <= slide.steps; step++)
      total += stateDuration(config, slide, index, step)
    return total
  }, 0)
}
