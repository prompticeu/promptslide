import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { bold, green, dim, red } from "../utils/ansi.mjs"
import { captureDeckPdf } from "../utils/export.mjs"

export async function toPdf(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`  ${bold("Usage:")} promptslide to-pdf [-o slides.pdf] [--port=N]`)
    return
  }
  const outputIndex = args.indexOf("-o")
  const output = resolve(outputIndex >= 0 ? args[outputIndex + 1] : "slides.pdf")
  const portArg = args.find(arg => arg.startsWith("--port="))
  const studioPort = portArg ? Number(portArg.slice(7)) : undefined
  console.log(`  ${dim("Rendering deck PDF...")}`)
  let pdf
  try {
    pdf = await captureDeckPdf({ cwd: process.cwd(), studioPort })
  } catch (error) {
    console.error(`  ${red("Error:")} ${error.message}`)
    process.exitCode = 1
    return
  }
  writeFileSync(output, pdf)
  console.log(`  ${green("✓")} Saved to ${bold(output)}`)
}
