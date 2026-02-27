import { existsSync } from "node:fs"
import { join } from "node:path"

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
 * Get the install command for adding dependencies.
 * @param {"bun" | "yarn" | "pnpm" | "npm"} pm
 * @param {string[]} packages
 * @returns {string}
 */
export function getInstallCommand(pm, packages) {
  const pkgStr = packages.join(" ")
  switch (pm) {
    case "bun":
      return `bun add ${pkgStr}`
    case "yarn":
      return `yarn add ${pkgStr}`
    case "pnpm":
      return `pnpm add ${pkgStr}`
    default:
      return `npm install ${pkgStr}`
  }
}
