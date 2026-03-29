/**
 * Dev server manager for MCP mode.
 *
 * Spawns a SINGLE Vite process for the entire deckRoot (~/.promptslide/decks/).
 * All decks are served via URL-based routing: /:deckSlug
 * Cleans up the child process when MCP exits.
 */

import { spawn } from "node:child_process"
import { createConnection } from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ENTRY = resolve(__dirname, "../index.mjs")

/** @type {{ child: import("node:child_process").ChildProcess, port: number } | null} */
let serverInstance = null

let cleanupRegistered = false

/**
 * Check if a port is already in use (i.e. dev server already running).
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const conn = createConnection({ port, host: "127.0.0.1" })
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
 * Ensure the single dev server is running. Returns the port.
 *
 * The server serves ALL decks from deckRoot via URL routing (/:deckSlug).
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Parent decks directory (e.g. ~/.promptslide/decks/)
 * @param {number} [options.port] - Preferred port (default 5173)
 * @returns {Promise<number>} Actual port
 */
export async function ensureDevServer({ deckRoot, port }) {
  // Already running — reuse
  if (serverInstance) {
    const alive = await isPortInUse(serverInstance.port)
    if (alive) return serverInstance.port
    // Child died, clean up
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
    [CLI_ENTRY, "studio", `--port=${targetPort}`, `--deck-root=${deckRoot}`],
    {
      cwd: deckRoot,
      stdio: ["ignore", "pipe", "pipe"],
      // Don't detach — let it die with the MCP process
    }
  )

  serverInstance = { child, port: targetPort }

  // Wait for the dev server to be ready (poll port)
  await new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 30 // 15 seconds

    // Capture stderr for error reporting
    let stderrOutput = ""
    child.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString()
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
