import { preview as vitePreview } from "vite"
import { bold, dim } from "../utils/ansi.mjs"

export async function preview(args) {
  const cwd = process.cwd()
  const portArg = args.find((a) => a.startsWith("--port="))
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 4173

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("preview")}`)
  console.log()

  const server = await vitePreview({
    root: cwd,
    preview: {
      port,
      strictPort: false,
    },
  })
  server.printUrls()
}
