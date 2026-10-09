import { createServer } from "vite"

import { bold, dim } from "../utils/ansi.mjs"
import { registerStudioServer } from "../utils/studio-discovery.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"
import { createViteConfig } from "../vite/config.mjs"

export async function studio(args) {
  const cwd = process.cwd()
  const portArg = args.find(a => a.startsWith("--port="))
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 5173
  const hasHost = args.includes("--host") || args.some(a => a.startsWith("--host="))
  const hostArg = args.find(a => a.startsWith("--host="))
  const host = hasHost ? (hostArg ? hostArg.split("=")[1] || "0.0.0.0" : "0.0.0.0") : "127.0.0.1"

  ensureTsConfig(cwd)

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("studio")}`)
  console.log()

  const config = createViteConfig({ cwd, mode: "development" })
  const server = await createServer({
    ...config,
    server: {
      port,
      host,
      strictPort: false,
      ...(hasHost && { allowedHosts: true })
    }
  })

  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (baseUrl) registerStudioServer(cwd, baseUrl)
  server.printUrls()
  server.bindCLIShortcuts({ print: true })
}
