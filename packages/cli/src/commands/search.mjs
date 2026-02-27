import { bold, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { searchRegistry } from "../utils/registry.mjs"

function padEnd(str, len) {
  str = String(str)
  return str.length >= len ? str : str + " ".repeat(len - str.length)
}

function printTable(items) {
  if (!items.length) {
    console.log(`  ${dim("No items found.")}`)
    return
  }

  const cols = { name: 24, type: 8, steps: 6, author: 20, downloads: 10 }

  console.log(
    `  ${dim(padEnd("Name", cols.name))}${dim(padEnd("Type", cols.type))}${dim(padEnd("Steps", cols.steps))}${dim(padEnd("Author", cols.author))}${dim("Downloads")}`
  )

  for (const item of items) {
    const steps = item.type === "deck" ? "—" : String(item.steps ?? 0)
    console.log(
      `  ${padEnd(item.name, cols.name)}${padEnd(item.type, cols.type)}${padEnd(steps, cols.steps)}${padEnd(item.author || "—", cols.author)}${item.downloads ?? 0}`
    )
  }
}

export async function search(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("search")}`)
  console.log()

  const query = args.filter(a => !a.startsWith("--")).join(" ")
  if (!query) {
    console.log(`  ${bold("Usage:")} promptslide search ${dim("<query>")}`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()

  try {
    const results = await searchRegistry({ search: query }, auth)
    console.log(`  Results for "${cyan(query)}":`)
    console.log()
    printTable(Array.isArray(results) ? results : results.items || [])
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  console.log()
}

export { printTable }
