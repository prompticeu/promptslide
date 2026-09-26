import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

export function projectIdentity(cwd) {
  return createHash("sha256").update(resolve(cwd)).digest("hex").slice(0, 16)
}

function discoveryPath(cwd) {
  return join(tmpdir(), `promptslide-studio-${projectIdentity(cwd)}.json`)
}

export function registerStudioServer(cwd, baseUrl) {
  const path = discoveryPath(cwd)
  writeFileSync(
    path,
    JSON.stringify({ root: resolve(cwd), baseUrl: baseUrl.replace(/\/$/, ""), pid: process.pid })
  )
  process.on("exit", () => {
    try {
      const current = JSON.parse(readFileSync(path, "utf8"))
      if (current.pid === process.pid) unlinkSync(path)
    } catch {
      /* Another process may have removed the file. */
    }
  })
}

export function readStudioServer(cwd) {
  try {
    const info = JSON.parse(readFileSync(discoveryPath(cwd), "utf8"))
    return info.root === resolve(cwd) ? info.baseUrl : null
  } catch {
    return null
  }
}
