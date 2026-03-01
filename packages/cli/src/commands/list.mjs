import { bold, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { searchRegistry } from "../utils/registry.mjs"
import { printTable } from "./search.mjs"

export async function list(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("list")}`)
  console.log()

  // Parse --type flag
  let type = null
  const typeIdx = args.indexOf("--type")
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    type = args[typeIdx + 1]
    const validTypes = ["slide", "layout", "deck", "theme"]
    if (!validTypes.includes(type)) {
      console.error(`  ${red("Error:")} Invalid type "${type}". Use: ${validTypes.join(", ")}`)
      process.exit(1)
    }
  }

  const auth = requireAuth()

  try {
    const results = await searchRegistry({ type }, auth)
    const label = type ? `${type}s` : "items"
    console.log(`  Registry ${label}${auth.organizationName ? ` for ${cyan(auth.organizationName)}` : ""}:`)
    console.log()
    printTable(Array.isArray(results) ? results : results.items || [])
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  console.log()
}
