import { createContext, useContext, type ReactNode } from "react"

import type { LoopConfig } from "../types"

import { DEFAULT_LOOP_CONFIG } from "./config.mjs"

const LoopContext = createContext<LoopConfig>(DEFAULT_LOOP_CONFIG)

/** The CLI supplies the deck's loop-config.json in development and production. */
export function LoopConfigProvider({
  config,
  children
}: {
  config: LoopConfig
  children: ReactNode
}) {
  return <LoopContext.Provider value={config}>{children}</LoopContext.Provider>
}

export const useDefaultLoopConfig = () => useContext(LoopContext)
