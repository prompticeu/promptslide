/** Traverse our open application roots without patching document/browser APIs. */
export function applicationRoots(root: Document | ShadowRoot = document): ShadowRoot[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-ps-app-host]")).flatMap(host =>
    host.shadowRoot ? [host.shadowRoot, ...applicationRoots(host.shadowRoot)] : []
  )
}
export function queryApplication<T extends Element = HTMLElement>(selector: string): T | null {
  return (
    document.querySelector<T>(selector) ??
    applicationRoots()
      .map(root => root.querySelector<T>(selector))
      .find(Boolean) ??
    null
  )
}
export function eventElement(event: Event): Element | null {
  return event.composedPath().find((node): node is Element => node instanceof Element) ?? null
}
export function activeElement(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element
}
