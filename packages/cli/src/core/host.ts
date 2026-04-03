export interface PromptSlideHostCapabilities {
  exportPdf?: (deckSlug: string) => Promise<boolean | void>
}

declare global {
  interface Window {
    __promptslideHost?: PromptSlideHostCapabilities
  }
}

export function getPromptSlideHost(): PromptSlideHostCapabilities | null {
  if (typeof window === "undefined") return null
  return window.__promptslideHost || null
}
