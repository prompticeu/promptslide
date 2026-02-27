import { createServer } from "vite"

import { bold, dim } from "../utils/ansi.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"
import { createViteConfig } from "../vite/config.mjs"

export async function studio(args) {
  const cwd = process.cwd()
  const portArg = args.find(a => a.startsWith("--port="))
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 5173

  ensureTsConfig(cwd)

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("studio")}`)
  console.log()

  const config = createViteConfig({ cwd, mode: "development" })
  const server = await createServer({
    ...config,
    server: { port, strictPort: false }
  })

  await server.listen()
  server.printUrls()
  server.bindCLIShortcuts({ print: true })
}
