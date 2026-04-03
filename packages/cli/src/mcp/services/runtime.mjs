import { ensureDevServer } from "../dev-server.mjs"
import { getRuntimeDiagnostics, getRuntimeSnapshot } from "./runtime-state.mjs"
import { resolveDeckContext } from "./workspace.mjs"

export async function ensureRuntimeContext({ deckRoot, deck } = {}) {
  const deckContext = resolveDeckContext(deckRoot, deck)
  const port = await ensureDevServer({ root: deckRoot })

  return {
    ...deckContext,
    port,
    runtime: getRuntimeSnapshot(deckRoot),
  }
}

export function getRuntimeInfo(root, options) {
  return getRuntimeSnapshot(root, options)
}

export function getRecentRuntimeDiagnostics(root, options) {
  return getRuntimeDiagnostics(root, options)
}
