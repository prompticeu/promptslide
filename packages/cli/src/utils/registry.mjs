import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const LOCKFILE = ".promptslide-lock.json"

/**
 * Read the lockfile from a project directory.
 * @param {string} cwd
 * @returns {{ items: Record<string, { version: number, installedAt: string }> }}
 */
export function readLockfile(cwd) {
  const path = join(cwd, LOCKFILE)
  if (!existsSync(path)) return { items: {} }
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    console.warn(`  Warning: ${LOCKFILE} is corrupt or unreadable. Starting fresh.`)
    return { items: {} }
  }
}

/**
 * Write the lockfile to a project directory.
 * @param {string} cwd
 * @param {{ items: Record<string, { version: number, installedAt: string }> }} data
 */
export function writeLockfile(cwd, data) {
  writeFileSync(join(cwd, LOCKFILE), JSON.stringify(data, null, 2) + "\n", "utf-8")
}

/**
 * Hash a string with SHA-256 and return the hex digest.
 * @param {string} content
 * @returns {string}
 */
export function hashContent(content) {
  return createHash("sha256").update(content, "utf-8").digest("hex")
}

/**
 * Hash a file on disk. Returns null if the file doesn't exist.
 * @param {string} filePath - Absolute path
 * @returns {string | null}
 */
export function hashFile(filePath) {
  if (!existsSync(filePath)) return null
  return hashContent(readFileSync(filePath, "utf-8"))
}

/**
 * Check if a file on disk differs from its stored hash.
 * Returns true if the file has been modified or doesn't exist.
 * @param {string} cwd
 * @param {string} relativePath - e.g. "src/slides/hero.tsx"
 * @param {string} storedHash
 * @returns {boolean}
 */
export function isFileDirty(cwd, relativePath, storedHash) {
  const currentHash = hashFile(join(cwd, relativePath))
  if (!currentHash) return true
  return currentHash !== storedHash
}

/**
 * Add or update a single item in the lockfile.
 * @param {string} cwd
 * @param {string} slug
 * @param {number} version
 * @param {Record<string, string>} files - Map of relative paths to content hashes
 */
export function updateLockfileItem(cwd, slug, version, files) {
  const lock = readLockfile(cwd)
  lock.items[slug] = {
    version,
    installedAt: new Date().toISOString().split("T")[0],
    files
  }
  writeLockfile(cwd, lock)
}

/**
 * Remove a single item from the lockfile.
 * @param {string} cwd
 * @param {string} slug
 */
export function removeLockfileItem(cwd, slug) {
  const lock = readLockfile(cwd)
  delete lock.items[slug]
  writeLockfile(cwd, lock)
}

/**
 * Fetch a registry item JSON from the registry API.
 * @param {string} nameOrUrl - Item name (e.g. "slide-hero-gradient") or full URL
 * @param {{ registry: string, apiKey: string }} auth - Auth credentials
 * @returns {Promise<object>} Registry item JSON
 */
export async function fetchRegistryItem(nameOrUrl, auth) {
  const url = nameOrUrl.startsWith("http")
    ? nameOrUrl
    : `${auth.registry}/api/r/${nameOrUrl}.json`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.token}` }
  })

  if (res.status === 401) {
    throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
  }
  if (res.status === 403) {
    throw new Error("Access denied. This item belongs to a different organization.")
  }
  if (res.status === 404) {
    throw new Error(`Item not found: ${nameOrUrl}`)
  }
  if (!res.ok) {
    throw new Error(`Registry error (${res.status}): ${await res.text()}`)
  }

  return res.json()
}

/**
 * Resolve all registry dependencies recursively.
 * Returns a flat list of all items to install (including the root item).
 * Skips items whose target files already exist locally.
 *
 * @param {object} item - Root registry item JSON
 * @param {{ registry: string, apiKey: string }} auth
 * @param {string} cwd - Project root directory
 * @returns {Promise<{ items: object[], npmDeps: Record<string, string> }>}
 */
export async function resolveRegistryDependencies(item, auth, cwd) {
  const seen = new Set()
  const items = []
  const npmDeps = {}

  async function resolve(current) {
    if (seen.has(current.name)) return
    seen.add(current.name)

    // Collect npm dependencies
    if (current.dependencies) {
      Object.assign(npmDeps, current.dependencies)
    }

    // Check if any files need writing (skip if all exist)
    const needsInstall = current.files?.some(f => {
      const targetPath = join(cwd, f.target, f.path)
      return !existsSync(targetPath)
    })

    if (needsInstall || current === item) {
      items.push(current)
    }

    // Recurse into registry dependencies
    if (current.registryDependencies?.length) {
      for (const depName of current.registryDependencies) {
        try {
          const depItem = await fetchRegistryItem(depName, auth)
          await resolve(depItem)
        } catch (err) {
          console.warn(`  Warning: Could not resolve dependency "${depName}": ${err.message}`)
        }
      }
    }
  }

  await resolve(item)
  return { items, npmDeps }
}

/**
 * Check if a registry item exists (by slug).
 * @param {string} name - Item slug
 * @param {{ registry: string, token: string }} auth
 * @returns {Promise<boolean>}
 */
export async function registryItemExists(name, auth) {
  try {
    await fetchRegistryItem(name, auth)
    return true
  } catch {
    return false
  }
}

/**
 * Search/list registry items.
 * @param {{ search?: string, type?: string }} params
 * @param {{ registry: string, apiKey: string }} auth
 * @returns {Promise<object[]>}
 */
export async function searchRegistry(params, auth) {
  const url = new URL(`${auth.registry}/api/r`)
  if (params.search) url.searchParams.set("search", params.search)
  if (params.type) url.searchParams.set("type", params.type)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${auth.token}` }
  })

  if (res.status === 401) {
    throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
  }
  if (!res.ok) {
    throw new Error(`Registry error (${res.status}): ${await res.text()}`)
  }

  return res.json()
}

/**
 * Publish an item to the registry.
 * @param {object} payload - Publish payload
 * @param {{ registry: string, apiKey: string }} auth
 * @returns {Promise<object>} Server response
 */
export async function publishToRegistry(payload, auth) {
  const res = await fetch(`${auth.registry}/api/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (res.status === 401) {
    throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Publish failed (${res.status}): ${body}`)
  }

  return res.json()
}

/**
 * Detect the package manager in use.
 * @param {string} cwd
 * @returns {"bun" | "yarn" | "pnpm" | "npm"}
 */
export function detectPackageManager(cwd) {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun"
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn"
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm"
  return "npm"
}

/**
 * Get the install command and args for adding dependencies.
 * Returns { cmd, args, display } for safe use with execFileSync.
 * @param {"bun" | "yarn" | "pnpm" | "npm"} pm
 * @param {string[]} packages
 * @returns {{ cmd: string, args: string[], display: string }}
 */
export function getInstallCommand(pm, packages) {
  // Validate package names to prevent injection
  for (const pkg of packages) {
    if (!/^@?[a-zA-Z0-9][-a-zA-Z0-9/._]*@[^\s]+$/.test(pkg)) {
      throw new Error(`Invalid package specifier: ${pkg}`)
    }
  }
  switch (pm) {
    case "bun":
      return { cmd: "bun", args: ["add", ...packages], display: `bun add ${packages.join(" ")}` }
    case "yarn":
      return { cmd: "yarn", args: ["add", ...packages], display: `yarn add ${packages.join(" ")}` }
    case "pnpm":
      return { cmd: "pnpm", args: ["add", ...packages], display: `pnpm add ${packages.join(" ")}` }
    default:
      return { cmd: "npm", args: ["install", ...packages], display: `npm install ${packages.join(" ")}` }
  }
}
