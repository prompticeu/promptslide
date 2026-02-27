#!/usr/bin/env node

// Thin wrapper so that `npm create slides` / `bun create slides` works.
// Delegates to the `promptslide create` command.

const { create } = await import("promptslide/src/commands/create.mjs")
await create(process.argv.slice(2))
