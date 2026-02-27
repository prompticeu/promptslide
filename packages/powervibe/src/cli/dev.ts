import { existsSync, writeFileSync, unlinkSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { createServer } from "vite"
import react from "@vitejs/plugin-react"
import { powervibe } from "../vite/plugin.js"
import { generateHtml } from "../vite/html-template.js"

export async function dev() {
  const cwd = process.cwd()
  const configPath = resolve(cwd, "deck.config.ts")
  const themePath = resolve(cwd, "theme.css")

  if (!existsSync(configPath)) {
    console.error("  Error: deck.config.ts not found in current directory.")
    console.error("  Run this command from your PowerVibe project root.")
    process.exit(1)
  }

  // Ensure theme.css exists (create default if missing)
  if (!existsSync(themePath)) {
    writeFileSync(themePath, defaultThemeCss(), "utf-8")
    console.log("  Created default theme.css")
  }

  // Write index.html for Vite to serve (cleaned up on exit)
  const indexPath = resolve(cwd, "index.html")
  writeFileSync(indexPath, generateHtml(), "utf-8")

  // Find the powervibe package root (for fs.allow with symlinks)
  const powervibeRoot = dirname(dirname(new URL(import.meta.url).pathname))

  const server = await createServer({
    root: cwd,
    configFile: false,
    publicDir: resolve(cwd, "public"),
    plugins: [
      react(),
      powervibe()
    ],
    resolve: {
      alias: {
        "/deck.config": configPath,
        "/theme.css": themePath
      }
    },
    css: {
      postcss: {
        plugins: [
          (await import("@tailwindcss/postcss")).default()
        ]
      }
    },
    server: {
      open: true,
      fs: {
        allow: [cwd, powervibeRoot]
      }
    }
  })

  // Clean up index.html on exit
  const cleanup = () => { try { unlinkSync(indexPath) } catch {} }
  process.on("SIGINT", () => { cleanup(); process.exit(0) })
  process.on("SIGTERM", () => { cleanup(); process.exit(0) })

  await server.listen()
  server.printUrls()
}

function defaultThemeCss(): string {
  return `/*
  Color Theme
  Customize your slide deck colors by editing the OKLCH values below.
  OKLCH format: oklch(lightness chroma hue)
  Change --primary to set your brand color.
*/

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  --primary: oklch(0.55 0.2 250);
  --primary-foreground: oklch(0.985 0 0);

  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  --radius: 0.625rem;

  --chart-1: oklch(0.55 0.2 250);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
}

.dark {
  --background: oklch(0.159 0 0);
  --foreground: oklch(0.985 0 0);

  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.6 0.2 250);
  --primary-foreground: oklch(0.985 0 0);

  --secondary: oklch(0.985 0 0);
  --secondary-foreground: oklch(0.141 0 0);

  --muted: oklch(0.305 0 0);
  --muted-foreground: oklch(0.712 0 0);

  --accent: oklch(0.305 0 0);
  --accent-foreground: oklch(0.925 0 0);

  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);

  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
}
`
}
