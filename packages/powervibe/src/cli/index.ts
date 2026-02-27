#!/usr/bin/env node

const command = process.argv[2]

async function main() {
  switch (command) {
    case "dev": {
      const { dev } = await import("./dev.js")
      await dev()
      break
    }
    case "build": {
      const { build } = await import("./build.js")
      await build()
      break
    }
    default: {
      console.log(`
  powervibe — vibe-code beautiful slide decks

  Usage:
    powervibe dev     Start development server
    powervibe build   Build for production

  Options:
    --help            Show this help message
`)
      if (command && command !== "--help" && command !== "-h") {
        console.error(`  Unknown command: ${command}`)
        process.exit(1)
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
