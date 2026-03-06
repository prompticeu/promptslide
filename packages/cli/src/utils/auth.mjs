import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const AUTH_DIR = join(homedir(), ".promptslide")
const AUTH_FILE = join(AUTH_DIR, "auth.json")

const DEFAULT_REGISTRY = "https://promptslide.eu"

/**
 * Load stored auth credentials.
 * Returns null if no auth file exists.
 */
export function loadAuth() {
  if (!existsSync(AUTH_FILE)) return null
  try {
    const data = JSON.parse(readFileSync(AUTH_FILE, "utf-8"))
    if (!data.token || !data.registry) return null
    return {
      registry: data.registry || DEFAULT_REGISTRY,
      token: data.token,
      organizationId: data.organizationId || null,
      organizationName: data.organizationName || null,
      organizationSlug: data.organizationSlug || null
    }
  } catch {
    return null
  }
}

/**
 * Save auth credentials to ~/.promptslide/auth.json.
 */
export function saveAuth({ registry, token, organizationId, organizationName, organizationSlug }) {
  mkdirSync(AUTH_DIR, { recursive: true })
  const data = {
    registry: registry || DEFAULT_REGISTRY,
    token,
    organizationId: organizationId || null,
    organizationName: organizationName || null,
    organizationSlug: organizationSlug || null
  }
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 })
}

/**
 * Clear stored auth credentials.
 * Returns true if file was removed, false if it didn't exist.
 */
export function clearAuth() {
  if (!existsSync(AUTH_FILE)) return false
  unlinkSync(AUTH_FILE)
  return true
}

/**
 * Load auth or exit with an error message.
 */
export function requireAuth() {
  const auth = loadAuth()
  if (!auth) {
    console.error("  Not authenticated. Run `promptslide login` first.")
    process.exit(1)
  }
  return auth
}

export { DEFAULT_REGISTRY, AUTH_FILE }
