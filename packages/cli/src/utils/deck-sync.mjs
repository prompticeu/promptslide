/**
 * Return the slide slugs backed by files in a resolved registry dependency set.
 * Only registry-provided files count; scaffold files already present in a target
 * directory must not make stale deck metadata look valid.
 *
 * @param {object[]} items
 * @returns {Set<string>}
 */
export function collectRegistrySlideSlugs(items) {
  const slugs = new Set()

  for (const item of items ?? []) {
    for (const file of item.files ?? []) {
      const target = String(file.target ?? "")
        .replaceAll("\\", "/")
        .replace(/^\.\//, "")
      const path = String(file.path ?? "")
        .replaceAll("\\", "/")
        .replace(/^\.\//, "")
      const fullPath = `${target.replace(/\/?$/, "/")}${path}`.replace(/\/+/g, "/")
      const match = fullPath.match(/^src\/slides\/(.+)\.tsx?$/)
      if (match) slugs.add(match[1])
    }
  }

  return slugs
}

/**
 * Split deck metadata into entries backed by registry files and stale entries.
 * Array order is preserved so generated deck configs match the published order.
 *
 * @param {object[]} slides
 * @param {Set<string>} availableSlugs
 * @returns {{ available: object[], missing: object[] }}
 */
export function partitionDeckSlides(slides, availableSlugs) {
  const available = []
  const missing = []

  for (const slide of slides ?? []) {
    if (availableSlugs.has(slide.slug)) available.push(slide)
    else missing.push(slide)
  }

  return { available, missing }
}

/**
 * Select slide files for deck publishing. By default, only files referenced by
 * deck-config.ts are included. The opt-in flag retains the legacy publish-all
 * behavior for users who intentionally publish scratch or library slides.
 *
 * @param {string[]} slideEntries
 * @param {{ slug: string }[]} configuredSlides
 * @param {boolean} includeUnreferenced
 * @returns {{ selected: string[], unreferenced: string[], missing: string[] }}
 */
export function selectSlidesForPublish(
  slideEntries,
  configuredSlides,
  includeUnreferenced = false
) {
  const filesBySlug = new Map(slideEntries.map(file => [file.replace(/\.tsx?$/, ""), file]))
  const configuredSlugs = new Set(configuredSlides.map(slide => slide.slug))
  const unreferenced = slideEntries.filter(
    file => !configuredSlugs.has(file.replace(/\.tsx?$/, ""))
  )
  const missing = configuredSlides.map(slide => slide.slug).filter(slug => !filesBySlug.has(slug))
  const selected = includeUnreferenced
    ? [...slideEntries]
    : configuredSlides.flatMap(slide => {
        const file = filesBySlug.get(slide.slug)
        return file ? [file] : []
      })

  return { selected, unreferenced, missing }
}
