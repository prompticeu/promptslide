/**
 * Dev server manager for MCP mode.
 *
 * Spawns a Vite process for the requested workspace root.
 * In multi-deck mode, the TSX runtime serves decks via `/:deckSlug`.
 * Cleans up the child process when MCP exits.
 */

import { spawn } from "node:child_process"
import { createConnection } from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import {
  recordProcessOutput,
  recordRuntimeEvent,
  setRuntimeStatus,
} from "./services/runtime-state.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ENTRY = resolve(__dirname, "../index.mjs")
const CLI_ROOT = resolve(__dirname, "../..")

/** @type {{ child: import("node:child_process").ChildProcess | null, port: number, root: string } | null} */
let serverInstance = null

let cleanupRegistered = false

/**
 * Register an externally managed dev server (e.g. started by the Tauri app launcher).
 * When set, ensureDevServer() will reuse this port instead of spawning a child process.
 *
 * @param {number} port - The port the dev server is already running on
 * @param {string} root - The deck root the dev server was started for
 */
export function registerExternalDevServer(port, root) {
  serverInstance = { child: null, port, root }
  setRuntimeStatus(root, {
    state: "ready",
    port,
    external: true,
    childPid: null,
  })
}

/**
 * Check if a port is already in use (i.e. dev server already running).
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const conn = createConnection({ port, host: "localhost" })
    conn.on("connect", () => {
      conn.destroy()
      resolve(true)
    })
    conn.on("error", () => {
      resolve(false)
    })
  })
}

/**
 * Ensure a dev server is running for the requested workspace root. Returns the port.
 *
 * @param {Object} options
 * @param {string} options.root - Deck directory to serve
 * @param {number} [options.port] - Preferred port (default 5173)
 * @returns {Promise<number>} Actual port
 */
export async function ensureDevServer({ root, port }) {
  // Already running for the same root — reuse
  if (serverInstance) {
    if (serverInstance.root === root) {
      // External server (no child process) — always trust it
      if (!serverInstance.child) {
        setRuntimeStatus(root, { state: "ready", port: serverInstance.port, external: true, childPid: null })
        return serverInstance.port
      }
      const alive = await isPortInUse(serverInstance.port)
      if (alive) {
        setRuntimeStatus(root, { state: "ready", port: serverInstance.port, external: false, childPid: serverInstance.child.pid ?? null })
        return serverInstance.port
      }
    }

    if (serverInstance.child && !serverInstance.child.killed) {
      recordRuntimeEvent(serverInstance.root, {
        phase: "runtime",
        severity: "info",
        source: "dev-server",
        message: `Stopping dev server on port ${serverInstance.port}`,
      })
      serverInstance.child.kill("SIGTERM")
    }
    serverInstance = null
  }

  // Pick a port
  let targetPort = port || 5173
  while (await isPortInUse(targetPort)) {
    targetPort++
  }

  // Spawn Vite as a child process
  const child = spawn(
    process.execPath,
    [CLI_ENTRY, "studio", `--port=${targetPort}`, `--deck-root=${root}`],
    {
      cwd: CLI_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // Don't detach — let it die with the MCP process
    }
  )

  serverInstance = { child, port: targetPort, root }
  setRuntimeStatus(root, {
    state: "starting",
    port: targetPort,
    external: false,
    childPid: child.pid ?? null,
  })
  recordRuntimeEvent(root, {
    phase: "runtime",
    severity: "info",
    source: "dev-server",
    message: `Starting dev server on port ${targetPort}`,
  })

  // Wait for the dev server to be ready (poll port)
  await new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 30 // 15 seconds

    // Capture stderr for error reporting
    let stderrOutput = ""
    child.stdout.on("data", (chunk) => {
      recordProcessOutput(root, chunk.toString(), { severity: "info", phase: "runtime", source: "vite" })
    })
    child.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString()
      recordProcessOutput(root, chunk.toString(), { severity: "warning", phase: "runtime", source: "vite" })
    })

    child.on("error", (err) => {
      setRuntimeStatus(root, { state: "error", port: targetPort, external: false, childPid: child.pid ?? null })
      recordRuntimeEvent(root, {
        phase: "runtime",
        severity: "error",
        source: "dev-server",
        message: `Failed to start dev server: ${err.message}`,
      })
      reject(new Error(`Failed to start dev server: ${err.message}`))
    })

    child.on("exit", (code) => {
      setRuntimeStatus(root, { state: code === 0 ? "stopped" : "error", port: targetPort, external: false, childPid: null })
      recordRuntimeEvent(root, {
        phase: "runtime",
        severity: code === 0 ? "info" : "error",
        source: "dev-server",
        message: code === 0
          ? `Dev server exited cleanly from port ${targetPort}`
          : `Dev server exited with code ${code}`,
        detail: stderrOutput || undefined,
      })
      if (code !== 0 && attempts < maxAttempts) {
        reject(new Error(`Dev server exited with code ${code}: ${stderrOutput}`))
      }
    })

    const check = async () => {
      attempts++
      if (await isPortInUse(targetPort)) {
        setRuntimeStatus(root, { state: "ready", port: targetPort, external: false, childPid: child.pid ?? null })
        recordRuntimeEvent(root, {
          phase: "runtime",
          severity: "info",
          source: "dev-server",
          message: `Dev server ready on port ${targetPort}`,
        })
        resolve()
        return
      }
      if (attempts >= maxAttempts) {
        setRuntimeStatus(root, { state: "error", port: targetPort, external: false, childPid: child.pid ?? null })
        recordRuntimeEvent(root, {
          phase: "runtime",
          severity: "error",
          source: "dev-server",
          message: "Dev server failed to start within 15 seconds",
          detail: stderrOutput || undefined,
        })
        reject(new Error("Dev server failed to start within 15 seconds"))
        return
      }
      setTimeout(check, 500)
    }

    check()
  })

  // Register cleanup handlers once
  if (!cleanupRegistered) {
    cleanupRegistered = true
    const cleanup = () => {
      if (serverInstance && serverInstance.child && !serverInstance.child.killed) {
        recordRuntimeEvent(serverInstance.root, {
          phase: "runtime",
          severity: "info",
          source: "dev-server",
          message: `Cleaning up dev server on port ${serverInstance.port}`,
        })
        serverInstance.child.kill("SIGTERM")
      }
    }
    process.on("exit", cleanup)
    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
  }

  return targetPort
}

/**
 * Get the current dev server port, if running.
 *
 * @returns {number|null}
 */
export function getDevServerPort() {
  return serverInstance?.port || null
}
