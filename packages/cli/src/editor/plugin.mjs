import { randomBytes } from "node:crypto"
import {
  readFileSync,
  realpathSync,
  writeFileSync,
  renameSync,
  statSync,
  readdirSync
} from "node:fs"
import { resolve, relative, sep, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, editSource, instrument, revision } from "./source.mjs"

export function editorPlugin({ root }) {
  root = realpathSync(root)
  const token = randomBytes(24).toString("hex")
  const base = resolve(root, "src")
  const client = resolve(dirname(fileURLToPath(import.meta.url)), "mount.ts")
  const clientUrl = "/@fs/" + client
  function sourcePath(path) {
    if (typeof path !== "string" || !/\.[jt]sx$/.test(path)) throw new Error("Invalid source path")
    const resolved = realpathSync(resolve(root, path))
    const realBase = realpathSync(base)
    if (!resolved.startsWith(realBase + sep)) throw new Error("Source must be inside project src/")
    return resolved
  }
  return {
    name: "promptslide-editor",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0]
      if (!path.startsWith(base + sep) || !/\.[jt]sx$/.test(path)) return
      return { code: instrument(code, relative(root, path)), map: null }
    },
    resolveId(id) {
      if (id === "virtual:promptslide-editor") return "\0" + id
    },
    load(id) {
      if (id !== "\0virtual:promptslide-editor") return
      return `import { mountEditor } from ${JSON.stringify(clientUrl)};
import { slides } from ${JSON.stringify(resolve(root, "src/deck-config.ts"))};
import { theme } from ${JSON.stringify(resolve(root, "src/theme.ts"))};
const dispose = mountEditor(slides, theme, ${JSON.stringify(token)}, import.meta.hot?.data.open ?? false);
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.open = document.querySelector('.ps-edit-action[aria-pressed="true"]') !== null;
    dispose?.();
    window.dispatchEvent(new Event("promptslide:editor-refresh"));
  });
}`
    },
    transformIndexHtml(html, ctx) {
      if (ctx.path !== "/" && ctx.path !== "/index.html") return
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { type: "module", src: "/@id/virtual:promptslide-editor" },
            injectTo: "body"
          }
        ]
      }
    },
    configureServer(server) {
      server.middlewares.use("/__promptslide_editor", (req, res) => {
        const send = (status, data) => {
          res.statusCode = status
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(data))
        }
        if (
          req.method !== "POST" ||
          req.headers["x-promptslide-editor"] !== token ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return send(403, { error: "Editor access denied" })
        let body = ""
        req.on("data", chunk => {
          body += chunk
          if (body.length > 2_000_000) req.destroy()
        })
        req.on("end", () => {
          try {
            const data = JSON.parse(body)
            if (data.action === "sources") {
              const paths = []
              function walk(directory) {
                for (const entry of readdirSync(directory, { withFileTypes: true })) {
                  if (
                    entry.name.startsWith(".") ||
                    entry.name === "node_modules" ||
                    entry.isSymbolicLink()
                  )
                    continue
                  const path = resolve(directory, entry.name)
                  if (entry.isDirectory()) walk(path)
                  else if (entry.isFile() && /\.[jt]sx$/.test(path))
                    paths.push(relative(root, path))
                }
              }
              walk(base)
              return send(200, { paths: paths.sort() })
            }
            if (data.action === "inspect") {
              const text = readFileSync(sourcePath(data.path), "utf8")
              return send(200, { revision: revision(text), nodes: describe(text) })
            }
            if (
              data.action !== "save" ||
              !Array.isArray(data.files) ||
              !data.files.length ||
              data.files.length > 100
            )
              throw new Error("Invalid edit batch")
            const seen = new Set()
            const prepared = data.files.map(file => {
              const path = sourcePath(file.path)
              if (seen.has(path)) throw new Error("Duplicate file")
              seen.add(path)
              const before = readFileSync(path, "utf8")
              if (revision(before) !== file.revision) {
                const error = new Error(
                  `Conflict in ${file.path}. Source changed; discard or export your draft before reloading.`
                )
                error.status = 409
                throw error
              }
              if (!Array.isArray(file.edits) || file.edits.length > 1000)
                throw new Error("Invalid edits")
              return {
                path,
                before,
                after: editSource(before, file.edits),
                mode: statSync(path).mode
              }
            })
            // No asynchronous gap between revision checks and commits. Roll back our writes if a commit fails.
            const written = []
            try {
              for (const file of prepared) {
                if (readFileSync(file.path, "utf8") !== file.before)
                  throw new Error("Source changed during save")
                const temp = file.path + ".promptslide-" + randomBytes(6).toString("hex")
                writeFileSync(temp, file.after, { flag: "wx", mode: file.mode })
                renameSync(temp, file.path)
                written.push(file)
              }
            } catch (error) {
              for (const file of written.reverse())
                if (readFileSync(file.path, "utf8") === file.after)
                  writeFileSync(file.path, file.before)
              throw error
            }
            // Invalidate synchronously so a reload immediately after Save cannot receive
            // the old transform while the filesystem watcher is still debouncing.
            for (const file of prepared) {
              for (const module of server.moduleGraph?.getModulesByFile(file.path) || [])
                server.moduleGraph.invalidateModule(module)
            }
            send(200, { saved: prepared.length })
          } catch (error) {
            send(error.status || 400, { error: error.message })
          }
        })
      })
    }
  }
}
