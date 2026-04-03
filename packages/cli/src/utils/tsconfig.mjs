import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function ensureTsConfig(cwd) {
  const tsconfigPath = join(cwd, "tsconfig.json")
  const existing = readJson(tsconfigPath)

  if (existing) {
    const next = normalizeTsConfig(existing)
    writeFileSync(tsconfigPath, JSON.stringify(next, null, 2) + "\n")
    return
  }

  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: "force",
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"]
      }
    },
    include: ["src"]
  }

  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n")
}

function readJson(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function normalizeTsConfig(config) {
  const compilerOptions = { ...(config.compilerOptions || {}) }
  const paths = { ...(compilerOptions.paths || {}) }

  delete paths.promptslide
  paths["@/*"] = ["./src/*"]

  compilerOptions.baseUrl = compilerOptions.baseUrl || "."
  compilerOptions.paths = paths

  return {
    ...config,
    compilerOptions,
    include: Array.isArray(config.include) && config.include.length ? config.include : ["src"],
  }
}
