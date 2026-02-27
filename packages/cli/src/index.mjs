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
  console.log(`    studio          Start the development studio`)
  console.log(`    build           Build for production`)
  console.log(`    preview         Preview the production build`)
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
