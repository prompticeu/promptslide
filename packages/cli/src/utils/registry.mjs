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
  const existing = lock.items[slug] || {}
  lock.items[slug] = {
    ...existing,
    version,
    installedAt: new Date().toISOString().split("T")[0],
    files
  }
  writeLockfile(cwd, lock)
}

/**
 * Store publish configuration (deckSlug) in the lockfile.
 * Removes the legacy deckPrefix key if present.
 * @param {string} cwd
 * @param {{ deckSlug?: string }} config
 */
export function updateLockfilePublishConfig(cwd, config) {
  const lock = readLockfile(cwd)
  if (config.deckSlug !== undefined) lock.deckSlug = config.deckSlug
  delete lock.deckPrefix
  writeLockfile(cwd, lock)
}

/**
 * Read stored deck-level publish metadata (title, description, tags).
 * @param {string} cwd
 * @returns {{ title?: string, description?: string, tags?: string[] }}
 */
export function readDeckMeta(cwd) {
  const lock = readLockfile(cwd)
  return lock.deckMeta || {}
}

/**
 * Persist deck-level publish metadata so it can be reused as defaults.
 * @param {string} cwd
 * @param {{ title?: string, description?: string, tags?: string[] }} meta
 */
export function updateDeckMeta(cwd, meta) {
  const lock = readLockfile(cwd)
  lock.deckMeta = { ...lock.deckMeta, ...meta }
  writeLockfile(cwd, lock)
}

/**
 * Read stored per-item publish metadata (title, description, tags, section).
 * @param {string} cwd
 * @param {string} slug
 * @returns {{ title?: string, description?: string, tags?: string[], section?: string }}
 */
export function readItemMeta(cwd, slug) {
  const lock = readLockfile(cwd)
  return lock.items[slug]?.meta || {}
}

/**
 * Persist per-item publish metadata alongside the version/files entry.
 * @param {string} cwd
 * @param {string} slug
 * @param {{ title?: string, description?: string, tags?: string[], section?: string }} meta
 */
export function updateItemMeta(cwd, slug, meta) {
  const lock = readLockfile(cwd)
  if (!lock.items[slug]) lock.items[slug] = {}
  lock.items[slug].meta = meta
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
 * Build common auth headers for registry API requests.
 * @param {{ token: string, organizationId?: string }} auth
 * @returns {Record<string, string>}
 */
function authHeaders(auth) {
  const headers = { Authorization: `Bearer ${auth.token}` }
  if (auth.organizationId) {
    headers["X-Organization-Id"] = auth.organizationId
  }
  return headers
}

/**
 * Fetch the user's organizations from the registry.
 * @param {{ registry: string, token: string }} auth
 * @returns {Promise<{ id: string, name: string, slug: string, role: string }[]>}
 */
export async function fetchOrganizations(auth) {
  const res = await fetch(`${auth.registry}/api/organizations`, {
    headers: authHeaders(auth)
  })

  if (res.status === 401) {
    throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch organizations (${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  return data.organizations || []
}

/**
 * Fetch a registry item JSON from the registry API.
 * @param {string} nameOrUrl - Item name (e.g. "slide-hero-gradient") or full URL
 * @param {{ registry: string, apiKey: string }} auth - Auth credentials
 * @returns {Promise<object>} Registry item JSON
 */
export async function fetchRegistryItem(nameOrUrl, auth, { retries = 2 } = {}) {
  const url = nameOrUrl.startsWith("http")
    ? nameOrUrl
    : `${auth.registry}/api/r/${nameOrUrl}.json`

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: authHeaders(auth)
      })

      if (res.status === 401) {
        throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}))
        if (body.status === "pending_review") {
          throw new Error(`Item "${nameOrUrl}" is pending review. An admin must approve it first.`)
        }
        if (body.status === "rejected") {
          throw new Error(`Item "${nameOrUrl}" was rejected by an admin.`)
        }
        throw new Error("Access denied. This item belongs to a different organization.")
      }
      if (res.status === 404) {
        throw new Error(`Item not found: ${nameOrUrl}`)
      }
      if (!res.ok) {
        throw new Error(`Registry error (${res.status}): ${await res.text()}`)
      }

      return res.json()
    } catch (err) {
      lastError = err
      // Only retry on network errors (fetch failed), not on HTTP-level errors
      if (err.message.includes("Authentication") || err.message.includes("Access denied") ||
          err.message.includes("not found") || err.message.includes("pending review") ||
          err.message.includes("rejected") || err.message.includes("Registry error")) {
        throw err
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  throw lastError
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

    // Always include items — add.mjs handles identical/overwrite logic per file
    items.push(current)

    // Resolve registry dependencies in parallel
    if (current.registryDependencies?.length) {
      const fetches = current.registryDependencies
        .filter(depName => !seen.has(depName))
        .map(async (depName) => {
          try {
            return await fetchRegistryItem(depName, auth)
          } catch (err) {
            console.warn(`  Warning: Could not resolve dependency "${depName}": ${err.message}`)
            return null
          }
        })
      const depItems = (await Promise.all(fetches)).filter(Boolean)
      await Promise.all(depItems.map(dep => resolve(dep)))
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
    headers: authHeaders(auth)
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
      ...authHeaders(auth),
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

/**
 * Request pre-signed upload tokens for binary files.
 * Returns empty array if registry doesn't support direct upload (local dev).
 *
 * @param {string} slug - Item slug
 * @param {{ path: string, contentType: string, size: number }[]} files
 * @param {{ registry: string, token: string }} auth
 * @returns {Promise<{ path: string, clientToken: string, pathname: string }[]>}
 */
export async function requestUploadTokens(slug, files, auth) {
  const res = await fetch(`${auth.registry}/api/publish/upload-tokens`, {
    method: "POST",
    headers: {
      ...authHeaders(auth),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ slug, files })
  })

  if (res.status === 404) {
    // Registry doesn't have this endpoint (older version) — fall back to inline
    return []
  }
  if (res.status === 401) {
    throw new Error("Authentication failed. Run `promptslide login` to re-authenticate.")
  }
  if (!res.ok) {
    throw new Error(`Failed to get upload tokens (${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  return data.tokens || []
}

/**
 * Upload a binary file directly to Vercel Blob using a scoped client token.
 * Uses raw fetch — no @vercel/blob dependency needed.
 *
 * @param {Buffer} buffer - Raw file bytes
 * @param {string} pathname - Target pathname in blob storage
 * @param {string} contentType - MIME type
 * @param {string} clientToken - Scoped Vercel Blob client token
 * @returns {Promise<string>} The permanent blob URL
 */
export async function uploadBinaryToBlob(buffer, pathname, contentType, clientToken) {
  const res = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${clientToken}`,
      "x-content-type": contentType,
      "x-api-version": "7",
      "x-vercel-blob-access": "private"
    },
    body: buffer
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Blob upload failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return result.url
}

/**
 * Convert a public/ file path to a registry slug.
 * Deterministic mapping used both during publish (to create the slug)
 * and during asset reference detection (to find the right dependency slug).
 *
 * "logo.png"           → "{prefix}/logo-png"
 * "images/hero.jpg"    → "{prefix}/images-hero-jpg"
 *
 * @param {string} prefix - Deck prefix (e.g. "my-deck")
 * @param {string} relativePath - Path relative to public/ (e.g. "images/hero.jpg")
 * @returns {string} Full registry slug
 */
export function assetFileToSlug(prefix, relativePath) {
  const segment = relativePath
    .replace(/[/\\]/g, "-")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return `${prefix}/${segment}`
}

/**
 * Scan component source for references to public/ assets.
 * Detects patterns like src="/file.png", href="/file.woff2", url('/file.jpg').
 *
 * @param {string} content - File source code (.tsx, .ts, .css)
 * @param {string} prefix - Registry prefix (e.g. "my-deck")
 * @param {Set<string>} publicFiles - Set of known public/ file paths (relative to public/)
 * @returns {string[]} Array of registry dependency slugs
 */
export function detectAssetDepsInContent(content, prefix, publicFiles) {
  const deps = new Set()
  const patterns = [
    /(?:src|href|poster|data-src)\s*=\s*\{?\s*["']\/([^"']+)["']/g,
    /url\(\s*["']?\/([^"')]+)["']?\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const filePath = match[1]
      if (publicFiles.has(filePath)) {
        deps.add(assetFileToSlug(prefix, filePath))
      }
    }
  }
  return Array.from(deps)
}
