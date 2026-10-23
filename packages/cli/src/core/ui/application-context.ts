import { createContext, useContext, type CSSProperties } from "react"

export const ApplicationContext = createContext<{
  host: HTMLElement
  root: ShadowRoot
  portal: HTMLElement
  inheritance: CSSProperties
} | null>(null)
export function useApplication() {
  const context = useContext(ApplicationContext)
  if (!context) throw new Error("Application controls must be inside an ApplicationRoot")
  return context
}
