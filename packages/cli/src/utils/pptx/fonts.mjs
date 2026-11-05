import { readdir, readFile, stat } from "node:fs/promises"
import { homedir, platform } from "node:os"
import { join } from "node:path"

import { fontInfo, FontResolver as SharedFontResolver } from "./font-core.mjs"
export {
  fontKey,
  sfntTables,
  buildSfnt,
  fontInfo,
  decodeFont,
  renameFont,
  fontToEot
} from "./font-core.mjs"
const MAX_FONT = 50 * 1024 * 1024

let systemFontIndex
export async function systemFonts() {
  if (systemFontIndex) return systemFontIndex
  systemFontIndex = (async () => {
    const roots =
      platform() === "win32"
        ? [join(process.env.WINDIR || "C:\\Windows", "Fonts")]
        : platform() === "darwin"
          ? ["/System/Library/Fonts", "/Library/Fonts", join(homedir(), "Library/Fonts")]
          : ["/usr/share/fonts", "/usr/local/share/fonts", join(homedir(), ".local/share/fonts")]
    const files = []
    async function walk(dir, depth = 0) {
      if (depth > 8 || files.length > 3000) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const file = join(dir, entry.name)
        if (entry.isDirectory()) await walk(file, depth + 1)
        else if (/\.(ttf|otf)$/i.test(entry.name)) files.push(file)
      }
    }
    for (const root of roots) await walk(root)
    const result = []
    for (const file of files)
      try {
        if ((await stat(file)).size > MAX_FONT) continue
        const bytes = await readFile(file)
        const info = fontInfo(bytes)
        delete info.tables
        delete info.names
        result.push({ file, info })
      } catch {
        /* Invalid/system-special fonts are not export candidates. */
      }
    return result
  })()
  return systemFontIndex
}

export class FontResolver extends SharedFontResolver {
  constructor(options = {}) {
    super({ ...options, readFile, systemFonts })
  }
}
