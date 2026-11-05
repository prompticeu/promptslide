import type { ReactNode } from "react"

import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import type { BrowserPptxOptions } from "../../browser"
import type { SlideConfig, ThemeConfig } from "../types"

import { AnimationProvider } from "../animation-context"
import { SlideErrorBoundary } from "../slide-error-boundary"
import { SlideThemeProvider } from "../theme-context"
import { abortable } from "./abort"
import { getPptxExportAdapters } from "./adapters"

export type BrowserExportMount = (children: ReactNode, container: HTMLElement) => void

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function ready(root: HTMLElement, signal: AbortSignal) {
  await frame()
  await frame()
  signal.throwIfAborted()
  const requests = new Map<string, string>()
  for (const element of root.querySelectorAll("*")) {
    if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent?.trim()))
      continue
    const css = getComputedStyle(element),
      font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`
    requests.set(font, (requests.get(font) || "") + element.textContent)
  }
  await Promise.all([...requests].map(([font, text]) => document.fonts.load(font, text)))
  // Wait only for this slide’s faces; unrelated viewer fonts may still be loading.
  await Promise.all(
    [...root.querySelectorAll("img")].map(async image => {
      if (!image.getClientRects().length || getComputedStyle(image).visibility !== "visible") return
      image.loading = "eager"
      try {
        await image.decode()
      } catch {
        throw new Error("ASSET_UNAVAILABLE: A slide image could not be loaded")
      }
    })
  )
  await frame()
  await frame()
  signal.throwIfAborted()
}

/** Mount one export slide at a time, separately from the visible presentation. */
export async function renderBrowserPptx(
  slides: SlideConfig[],
  theme: ThemeConfig | null,
  options: Pick<BrowserPptxOptions, "mode" | "buildMode" | "signal" | "onProgress">,
  mount?: BrowserExportMount
) {
  options.signal?.throwIfAborted()
  const { exportBrowserPptx } = await abortable(import("promptslide/browser"), options.signal)
  options.signal?.throwIfAborted()
  const container = document.createElement("div")
  container.setAttribute("aria-hidden", "true")
  container.setAttribute("inert", "")
  container.setAttribute("data-ps-browser-export-host", "")
  Object.assign(container.style, {
    position: "fixed",
    left: "-20000px",
    top: "0",
    width: "1280px",
    height: "720px",
    pointerEvents: "none"
  })
  document.body.appendChild(container)
  const reactRoot = mount ? undefined : createRoot(container)
  const update = (children: ReactNode) => {
    if (mount) mount(children, container)
    else flushSync(() => reactRoot!.render(children))
  }
  const usedIds = new Set(slides.flatMap(slide => (slide.id ? [slide.id] : [])))
  const manifest = slides.map((slide, index) => {
    let id = slide.id
    if (!id) {
      id = `legacy-${index + 1}`
      while (usedIds.has(id)) id += "-legacy"
      usedIds.add(id)
    }
    return { id, steps: slide.steps || 0, title: slide.title, notes: slide.notes }
  })
  try {
    return await exportBrowserPptx({
      ...options,
      theme: theme || {},
      adapters: getPptxExportAdapters(),
      fontSources: theme?.pptx?.fonts?.map(font => ({
        ...font,
        url: font.path.replace(/^public\//, "")
      })),
      manifest,
      render: async (index, step, showAll, signal) => {
        const slide = slides[index]!,
          Component = slide.component
        update(
          <SlideThemeProvider theme={theme || {}}>
            <div
              key={`${index}:${step}`}
              data-ps-pptx-root
              style={{
                position: "relative",
                width: 1280,
                height: 720,
                overflow: "hidden",
                background: "black"
              }}
            >
              <AnimationProvider
                currentStep={step}
                totalSteps={slide.steps || 0}
                showAllAnimations={showAll}
                isExporting
              >
                <SlideErrorBoundary slideIndex={index} slideTitle={slide.title}>
                  <Component slideNumber={index + 1} totalSlides={slides.length} />
                </SlideErrorBoundary>
              </AnimationProvider>
            </div>
          </SlideThemeProvider>
        )
        const root = container.querySelector<HTMLElement>("[data-ps-pptx-root]")!
        await abortable(ready(root, signal), signal)
        return root
      }
    })
  } finally {
    if (mount) mount(null, container)
    else reactRoot!.unmount()
    container.remove()
  }
}
