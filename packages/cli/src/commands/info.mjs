import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { fetchRegistryItem, readLockfile } from "../utils/registry.mjs"

export async function info(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("info")}`)
  console.log()

  const name = args[0]
  if (!name || name === "--help" || name === "-h") {
    console.log(`  ${bold("Usage:")} promptslide info ${dim("<name>")}`)
    console.log()
    console.log(`  Show details about a registry item.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide info slide-hero-gradient`)
    console.log(`    promptslide info deck-pitch`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()

  let item
  try {
    item = await fetchRegistryItem(name, auth)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  // Check local install status
  const cwd = process.cwd()
  const lock = readLockfile(cwd)
  const installed = lock.items[item.name]

  const lines = [
    ["Name", item.name],
    ["Title", item.title || dim("—")],
    ["Type", item.type],
    ["Version", `v${item.version}`],
    ["Steps", item.steps ?? item.meta?.steps ?? 0],
    ["Downloads", item.downloads ?? 0],
    ["Tags", item.tags?.length ? item.tags.join(", ") : dim("none")],
    ["Description", item.description || dim("—")],
  ]

  if (item.dependencies && Object.keys(item.dependencies).length > 0) {
    lines.push(["Dependencies", Object.entries(item.dependencies).map(([n, v]) => `${n}@${v}`).join(", ")])
  }

  if (item.registryDependencies?.length) {
    lines.push(["Registry deps", item.registryDependencies.join(", ")])
  }

  if (item.files?.length) {
    lines.push(["Files", item.files.map(f => `${f.target}${f.path}`).join(", ")])
  }

  if (installed) {
    lines.push(["Installed", `${green("yes")} — v${installed.version} (${installed.installedAt})`])
    if (installed.version < item.version) {
      lines.push(["", `${cyan("Update available:")} v${installed.version} → v${item.version}`])
    }
  } else {
    lines.push(["Installed", dim("no")])
  }

  // Find max label width for alignment
  const maxLabel = Math.max(...lines.map(([label]) => label.length))

  for (const [label, value] of lines) {
    const paddedLabel = label ? `${label}:`.padEnd(maxLabel + 2) : " ".repeat(maxLabel + 2)
    console.log(`  ${dim(paddedLabel)} ${value}`)
  }

  console.log()
}
