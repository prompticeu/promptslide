import { writeFileSync } from "node:fs"
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
        "promptslide-core": ["./node_modules/promptslide-core/src/index.ts"]
      }
    },
    include: ["src"]
  }

  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n")
}
