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

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ENTRY = resolve(__dirname, "../index.mjs")

/** @type {{ child: import("node:child_process").ChildProcess | null, port: number, root: string } | null} */
let serverInstance = null

let cleanupRegistered = false

// Continuous stderr buffer from the dev server child process
const recentStderr = []
const MAX_STDERR_LINES = 100

/**
 * Register an externally managed dev server (e.g. started by the Tauri app launcher).
 * When set, ensureDevServer() will reuse this port instead of spawning a child process.
 *
 * @param {number} port - The port the dev server is already running on
 * @param {string} root - The deck root the dev server was started for
 */
export function registerExternalDevServer(port, root) {
  serverInstance = { child: null, port, root }
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
      if (!serverInstance.child) return serverInstance.port
      const alive = await isPortInUse(serverInstance.port)
      if (alive) return serverInstance.port
    }

    if (serverInstance.child && !serverInstance.child.killed) {
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
    [CLI_ENTRY, "studio", `--port=${targetPort}`],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      // Don't detach — let it die with the MCP process
    }
  )

  serverInstance = { child, port: targetPort, root }

  // Wait for the dev server to be ready (poll port)
  await new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 30 // 15 seconds

    // Capture stderr for error reporting (startup + continuous buffer)
    let stderrOutput = ""
    child.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString()
      const lines = chunk.toString().split('\n').filter(Boolean)
      recentStderr.push(...lines)
      while (recentStderr.length > MAX_STDERR_LINES) recentStderr.shift()
    })

    child.on("error", (err) => {
      reject(new Error(`Failed to start dev server: ${err.message}`))
    })

    child.on("exit", (code) => {
      if (code !== 0 && attempts < maxAttempts) {
        reject(new Error(`Dev server exited with code ${code}: ${stderrOutput}`))
      }
    })

    const check = async () => {
      attempts++
      if (await isPortInUse(targetPort)) {
        resolve()
        return
      }
      if (attempts >= maxAttempts) {
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

/**
 * Get recent stderr output from the dev server child process.
 *
 * @returns {string[]}
 */
export function getRecentStderr() {
  return recentStderr.slice()
}
