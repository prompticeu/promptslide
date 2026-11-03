import { randomUUID } from "node:crypto"
import { mkdir, writeFile, rename, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { bold, green, red } from "../utils/ansi.mjs"
import { exportDeckPptx } from "../utils/pptx/export.mjs"
import { validateOptions } from "../utils/pptx/options.mjs"

export function parsePptxArgs(args) {
  const parsed = {},
    options = {},
    names = {
      mode: "mode",
      profile: "profile",
      builds: "buildMode",
      "font-policy": "fontPolicy",
      timeout: "timeout"
    }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-o" || arg === "--output" || arg.startsWith("--output=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i]
      if (!value || value.startsWith("-")) throw new Error("Output requires a path")
      parsed.output = resolve(value)
      continue
    }
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (!match || (!names[match[1]] && !["report", "port"].includes(match[1])))
      throw new Error(`Unknown argument: ${arg}`)
    const name = match[1],
      value = match[2] ?? args[++i]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`)
    if (name === "report") parsed.report = resolve(value)
    else if (name === "port") {
      const port = Number(value)
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error("Invalid Studio port")
      parsed.studioPort = port
    } else options[names[name]] = name === "timeout" ? Number(value) : value
  }
  parsed.output ||= resolve("slides.pptx")
  parsed.report ||= parsed.output + ".report.json"
  if (parsed.output === parsed.report)
    throw new Error("PowerPoint output and report paths must differ")
  return { ...parsed, options: validateOptions(options) }
}
async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = path + "." + randomUUID() + ".tmp"
  try {
    await writeFile(temporary, bytes, { flag: "wx" })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}
export async function toPptx(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: promptslide to-pptx [-o slides.pptx] [--mode=balanced|strict] [--profile=core-native|extended] [--builds=final|slides|native] [--font-policy=embed-when-permitted|require-installed] [--report=path] [--timeout=seconds] [--port=N]"
    )
    return
  }
  let config
  const controller = new AbortController(),
    cancel = () => controller.abort(new DOMException("Export cancelled", "AbortError"))
  process.once("SIGINT", cancel)
  try {
    config = parsePptxArgs(args)
    console.log("Rendering editable PowerPoint…")
    const { pptx, report } = await exportDeckPptx({
      cwd: process.cwd(),
      studioPort: config.studioPort,
      ...config.options,
      signal: controller.signal,
      onProgress: p => {
        if (p.phase === "rendering") console.log(`  Rendered ${p.completed}/${p.total}`)
      }
    })
    await atomicWrite(config.report, JSON.stringify(report, null, 2) + "\n")
    if (!pptx) {
      process.exitCode = 2
      console.error(`Strict profile rejected export. Review ${config.report}`)
      return
    }
    await atomicWrite(config.output, pptx)
    console.log(`  ${green("✓")} Saved ${bold(config.output)}`)
    console.log(
      `  Report: ${config.report} (${report.issues.filter(i => i.severity === "warning").length} compatibility issues)`
    )
  } catch (error) {
    if (config && error.report)
      await atomicWrite(config.report, JSON.stringify(error.report, null, 2) + "\n")
    process.exitCode = controller.signal.aborted ? 130 : 1
    console.error(`  ${red("Error:")} ${error.message}`)
  } finally {
    process.removeListener("SIGINT", cancel)
  }
}
