import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    config: "src/config.ts",
    "vite/plugin": "src/vite/plugin.ts",
    "cli/index": "src/cli/index.ts"
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["react", "react-dom", "framer-motion"],
  banner: {
    js: "/* powervibe - vibe-code beautiful slide decks */"
  }
})
