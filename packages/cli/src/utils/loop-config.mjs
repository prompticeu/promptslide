import { randomUUID } from "node:crypto"
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync, lstatSync } from "node:fs"
import { join } from "node:path"

import { DEFAULT_LOOP_CONFIG, validateLoopConfig } from "../core/loop/config.mjs"

export function readLoopConfig(root) {
  const path = join(root, "loop-config.json")
  if (!existsSync(path)) return undefined
  if (lstatSync(path).isSymbolicLink()) throw new Error("loop-config.json must be a regular file")
  return validateLoopConfig(JSON.parse(readFileSync(path, "utf8")))
}

export function writeLoopConfig(root, config) {
  const value = validateLoopConfig(config)
  const path = join(root, "loop-config.json")
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw new Error("loop-config.json must be a regular file")
  const temporary = join(root, `.loop-config-${randomUUID()}.tmp`)
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" })
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

export function loopConfigMiddleware(root, onSaved = () => {}) {
  return (req, res, next) => {
    if (req.url !== "/__promptslide_loop") return next()
    if (req.method !== "POST") {
      res.statusCode = 405
      return res.end()
    }
    const host = req.headers.host || ""
    const remote = req.socket.remoteAddress
    if (
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote) ||
      req.headers.origin !== `http://${host}` ||
      !req.headers["content-type"]?.startsWith("application/json")
    ) {
      res.statusCode = 403
      return res.end("Loop settings can only be saved from local Studio.")
    }
    let body = ""
    req.on("data", chunk => {
      body += chunk
      if (Buffer.byteLength(body) > 65536) {
        res.statusCode = 413
        res.end()
        req.destroy()
      }
    })
    req.on("end", () => {
      if (res.writableEnded) return
      try {
        writeLoopConfig(root, JSON.parse(body))
        onSaved()
        res.statusCode = 204
        res.end()
      } catch {
        res.statusCode = 400
        res.end("Invalid loop settings or project file could not be written.")
      }
    })
  }
}

export { DEFAULT_LOOP_CONFIG }
