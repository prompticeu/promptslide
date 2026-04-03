import { createDiagnostic } from "./diagnostics.mjs"

const MAX_EVENTS = 200

/** @type {Map<string, { status: Record<string, unknown>, events: Array<Record<string, unknown>> }>} */
const runtimeState = new Map()

function getState(root) {
  if (!runtimeState.has(root)) {
    runtimeState.set(root, {
      status: {
        root,
        state: "idle",
        port: null,
        external: false,
        childPid: null,
        updatedAt: null,
      },
      events: [],
    })
  }

  return runtimeState.get(root)
}

export function setRuntimeStatus(root, patch = {}) {
  const state = getState(root)
  state.status = {
    ...state.status,
    ...patch,
    root,
    updatedAt: new Date().toISOString(),
  }
  return state.status
}

export function recordRuntimeEvent(root, event = {}) {
  const state = getState(root)
  const timestamp = new Date().toISOString()
  const diagnostic = createDiagnostic({
    phase: event.phase || "runtime",
    severity: event.severity || "info",
    target: event.target || null,
    message: event.message,
    detail: event.detail,
    source: event.source,
    path: event.path,
    code: event.code,
    hint: event.hint,
    timestamp,
  })

  state.events.push(diagnostic)
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS)
  }

  return diagnostic
}

export function recordProcessOutput(root, text, { severity = "info", phase = "runtime", source = "vite" } = {}) {
  const lines = String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    recordRuntimeEvent(root, {
      phase,
      severity,
      source,
      message: line,
    })
  }
}

export function getRuntimeSnapshot(root, { limit = 25 } = {}) {
  const state = getState(root)
  return {
    ...state.status,
    events: state.events.slice(-limit),
  }
}

export function getRuntimeDiagnostics(root, { severities = ["warning", "error"], limit = 20 } = {}) {
  const state = getState(root)
  return state.events.filter(event => severities.includes(event.severity)).slice(-limit)
}

export function clearRuntimeState(root) {
  runtimeState.delete(root)
}
