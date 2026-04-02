import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  root: __dirname,
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "mcp-app.html"),
    },
    outDir: path.resolve(__dirname, "..", "..", "..", "dist"),
    emptyOutDir: false,
  },
})
