import {
  useId,
  useLayoutEffect,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type ContextType
} from "react"
import { createPortal } from "react-dom"

import { applicationStyles } from "./app-styles"
import { ApplicationContext, useApplication } from "./application-context"

/** CSS never crosses this boundary. Authored slides are assigned light-DOM slots. */
export function ApplicationRoot({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [context, setContext] = useState<ContextType<typeof ApplicationContext>>(null)
  useLayoutEffect(() => {
    if (!host) return
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    const portal = document.createElement("div")
    portal.className = "ps-application"
    portal.dataset.psPortals = ""
    root.append(portal)
    const refresh = () => {
      // Slotted content inherits from its slot. Restore the author's inherited
      // values explicitly, so even the application's font/reset cannot leak back.
      const source = getComputedStyle(host.parentElement ?? document.documentElement)
      const inherited: Record<string, string> = {}
      for (const name of source)
        if (name.startsWith("--")) inherited[name] = source.getPropertyValue(name)
      for (const name of [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "lineHeight",
        "letterSpacing",
        "color",
        "textAlign",
        "textTransform",
        "direction",
        "colorScheme"
      ] as const)
        inherited[name] = source[name]
      setContext(previous => ({
        host,
        root,
        portal,
        inheritance:
          JSON.stringify(previous?.inheritance) === JSON.stringify(inherited)
            ? previous!.inheritance
            : inherited
      }))
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"]
    })
    if (host.parentElement)
      observer.observe(host.parentElement, {
        attributes: true,
        attributeFilter: ["style", "class"]
      })
    window.dispatchEvent(new Event("promptslide:application-ready"))
    return () => {
      observer.disconnect()
      portal.remove()
    }
  }, [host])
  return (
    <div data-ps-app-host ref={setHost} style={{ display: "contents" }}>
      {context &&
        createPortal(
          <ApplicationContext.Provider value={context}>
            <style>{applicationStyles}</style>
            <div data-ps-app className="ps-application">
              {children}
            </div>
          </ApplicationContext.Provider>,
          context.root
        )}
    </div>
  )
}
/** Keep source elements in the document for CSS, editor selection and PDF capture. */
export function SlideSlot({ children, ref, style, ...props }: ComponentPropsWithRef<"div">) {
  const { host, inheritance } = useApplication()
  const name = useId()
  const [target] = useState(() => document.createElement("div"))
  useLayoutEffect(() => {
    target.slot = name
    target.style.display = "contents"
    host.append(target)
    return () => target.remove()
  }, [host, target, name])
  return (
    <>
      <slot name={name} />
      {createPortal(
        <div {...props} data-ps-slide ref={ref} style={{ ...inheritance, ...style }}>
          {children}
        </div>,
        target
      )}
    </>
  )
}
