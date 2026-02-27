import type { Plugin } from "vite"

const VIRTUAL_ENTRY_ID = "virtual:powervibe-entry"
const RESOLVED_VIRTUAL_ENTRY_ID = "\0" + VIRTUAL_ENTRY_ID

/**
 * Vite plugin that provides the virtual entry module for PowerVibe.
 * This stitches together the user's deck.config.ts with the framework
 * rendering pipeline.
 *
 * Uses React.createElement instead of JSX since virtual modules
 * are treated as plain JS by Vite's transform pipeline.
 */
export function powervibe(): Plugin {
  return {
    name: "powervibe",

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return RESOLVED_VIRTUAL_ENTRY_ID
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ENTRY_ID) {
        return `
import { StrictMode, createElement as h } from "react"
import { createRoot } from "react-dom/client"
import { SlideBrandingProvider, SlideDeck } from "powervibe"
import "powervibe/css"
import deckConfig from "/deck.config"
import "/theme.css"

const { slides, branding, transition, directionalTransition } = deckConfig

function App() {
  const deck = h(SlideDeck, { slides, transition, directionalTransition })
  return branding
    ? h(SlideBrandingProvider, { branding }, deck)
    : deck
}

createRoot(document.getElementById("root")).render(
  h(StrictMode, null, h(App))
)
`
      }
    }
  }
}
