import { rm } from "node:fs/promises"

import { defineConfig } from "tsup"

import { browserEngines } from "./build/browser-engines.mjs"

export default defineConfig(async () => {
  // Clean once before either build starts; parallel entry builds share dist.
  await rm("dist", { recursive: true, force: true })
  return [
    {
      entry: ["src/core/index.ts"],
      format: ["esm"],
      dts: true,
      sourcemap: true,
      clean: false,
      external: ["react", "react-dom", "framer-motion", "promptslide/browser"]
    },
    {
      entry: { browser: "src/browser/index.ts" },
      format: ["esm"],
      platform: "browser",
      target: "es2020",
      dts: true,
      sourcemap: true,
      clean: false,
      noExternal: [/.*/],
      esbuildPlugins: [browserEngines()]
    }
  ]
})
