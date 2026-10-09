import { createElement } from "react"
import { createRoot } from "react-dom/client"

import { EditorLauncher } from "./studio"

// Keep mounting outside the component module so React Fast Refresh can retain
// the open editor, its draft, and its history when the sidebar code changes.
export function mountEditor(
  _slides: unknown,
  _theme: unknown,
  token: string,
  initiallyOpen = false
) {
  if (document.getElementById("promptslide-editor-root")) return
  const host = document.createElement("div")
  host.id = "promptslide-editor-root"
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(createElement(EditorLauncher, { token, initiallyOpen }))
  return () => {
    root.unmount()
    host.remove()
  }
}
