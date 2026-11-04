import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function ensureTsConfig(cwd) {
  const tsconfigPath = join(cwd, "tsconfig.json")

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
        "@/*": ["./src/*"],
        promptslide: ["./node_modules/promptslide/src/core/index.ts"]
      }
    },
    include: ["src"]
  }

  const content = JSON.stringify(tsconfig, null, 2) + "\n"
  try {
    if (readFileSync(tsconfigPath, "utf8") === content) return
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  writeFileSync(tsconfigPath, content)
}
