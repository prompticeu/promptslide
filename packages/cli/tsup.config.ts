import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/core/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "framer-motion"],
})
