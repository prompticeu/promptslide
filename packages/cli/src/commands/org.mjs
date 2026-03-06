import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth, saveAuth } from "../utils/auth.mjs"
import { fetchOrganizations } from "../utils/registry.mjs"
import { prompt, closePrompts } from "../utils/prompts.mjs"

export async function org(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("org")}`)
  console.log()

  const auth = requireAuth()

  let orgs
  try {
    orgs = await fetchOrganizations(auth)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  if (orgs.length === 0) {
    console.log(`  No organizations found. Create one at your dashboard.`)
    console.log()
    closePrompts()
    return
  }

  console.log(`  ${bold("Your organizations:")}`)
  orgs.forEach((o, i) => {
    const current = o.id === auth.organizationId ? ` ${green("← current")}` : ""
    console.log(`    ${dim(`${i + 1}.`)} ${o.name} ${dim(`(${o.slug})`)}${current}`)
  })
  console.log()

  if (orgs.length === 1) {
    if (auth.organizationId !== orgs[0].id) {
      saveAuth({ ...auth, organizationId: orgs[0].id, organizationName: orgs[0].name, organizationSlug: orgs[0].slug })
      console.log(`  ${green("✓")} Switched to ${bold(orgs[0].name)}`)
    } else {
      console.log(`  Already using ${bold(orgs[0].name)}.`)
    }
    console.log()
    closePrompts()
    return
  }

  const choice = await prompt("Switch to organization number:", "")
  if (!choice) {
    console.log()
    closePrompts()
    return
  }

  const idx = parseInt(choice, 10) - 1
  if (idx < 0 || idx >= orgs.length) {
    console.error(`  ${red("Error:")} Invalid selection.`)
    console.log()
    closePrompts()
    process.exit(1)
  }

  const selected = orgs[idx]
  saveAuth({ ...auth, organizationId: selected.id, organizationName: selected.name, organizationSlug: selected.slug })
  console.log(`  ${green("✓")} Switched to ${bold(selected.name)}`)
  console.log()

  closePrompts()
}
