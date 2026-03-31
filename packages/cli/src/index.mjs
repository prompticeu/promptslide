#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { bold, dim, red } from "./utils/ansi.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getVersion() {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"))
  return pkg.version
}

function printHelp() {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim(`v${getVersion()}`)}`)
  console.log()
  console.log(`  ${bold("Commands:")}`)
  console.log(`    create ${dim("<dir>")}   Scaffold a new slide deck project`)
  console.log(`    clone ${dim("<slug>")}    Clone a published deck to work on it`)
  console.log(`    studio          Start the development studio`)
  console.log(`    build           Build for production`)
  console.log(`    preview         Preview the production build`)
  console.log()
  console.log(`  ${bold("Registry:")}`)
  console.log(`    login           Authenticate with the slide registry`)
  console.log(`    logout          Clear stored credentials`)
  console.log(`    org             List and switch organizations`)
  console.log(`    add ${dim("<name>")}     Install a slide/deck from the registry`)
  console.log(`    publish ${dim("[file]")} Publish a slide to the registry`)
  console.log(`    update ${dim("[name]")}  Check for and apply updates`)
  console.log(`    pull            Pull the latest deck from the registry`)
  console.log(`    remove ${dim("<name>")}  Remove an installed item`)
  console.log(`    info ${dim("<name>")}    Show details about a registry item`)
  console.log(`    search ${dim("<query>")} Search the registry`)
  console.log(`    list ${dim("[--type]")}  List registry items`)
  console.log()
  console.log(`  ${bold("Tools:")}`)
  console.log(`    to-image ${dim("<slide>")} Export a slide as a PNG image`)
  console.log()
  console.log(`  ${bold("Options:")}`)
  console.log(`    --help, -h      Show this help message`)
  console.log(`    --version, -v   Show version number`)
  console.log()
}

const command = process.argv[2]
const args = process.argv.slice(3)

switch (command) {
  case "create": {
    const { create } = await import("./commands/create.mjs")
    await create(args)
    break
  }
  case "clone": {
    const { clone } = await import("./commands/clone.mjs")
    await clone(args)
    break
  }
  case "studio": {
    const { studio } = await import("./commands/studio.mjs")
    await studio(args)
    break
  }
  case "build": {
    const { build } = await import("./commands/build.mjs")
    await build(args)
    break
  }
  case "preview": {
    const { preview } = await import("./commands/preview.mjs")
    await preview(args)
    break
  }
  case "login": {
    const { login } = await import("./commands/login.mjs")
    await login(args)
    break
  }
  case "logout": {
    const { logout } = await import("./commands/logout.mjs")
    await logout(args)
    break
  }
  case "org": {
    const { org } = await import("./commands/org.mjs")
    await org(args)
    break
  }
  case "add": {
    const { add } = await import("./commands/add.mjs")
    await add(args)
    break
  }
  case "publish": {
    const { publish } = await import("./commands/publish.mjs")
    await publish(args)
    break
  }
  case "update": {
    const { update } = await import("./commands/update.mjs")
    await update(args)
    break
  }
  case "pull": {
    const { pull } = await import("./commands/pull.mjs")
    await pull(args)
    break
  }
  case "search": {
    const { search } = await import("./commands/search.mjs")
    await search(args)
    break
  }
  case "list": {
    const { list } = await import("./commands/list.mjs")
    await list(args)
    break
  }
  case "remove": {
    const { remove } = await import("./commands/remove.mjs")
    await remove(args)
    break
  }
  case "info": {
    const { info } = await import("./commands/info.mjs")
    await info(args)
    break
  }
  case "to-image": {
    const { toImage } = await import("./commands/to-image.mjs")
    await toImage(args)
    break
  }
  case "--help":
  case "-h":
  case undefined:
    printHelp()
    break
  case "--version":
  case "-v":
    console.log(getVersion())
    break
  default:
    console.error(`  ${red("Error:")} Unknown command "${command}"`)
    printHelp()
    process.exit(1)
}
