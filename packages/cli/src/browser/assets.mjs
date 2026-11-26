import { Buffer } from "buffer"

export async function assetBytes(url, { signal, maxBytes = 50 * 1024 * 1024 } = {}) {
  const parsed = new URL(url, document.baseURI)
  if (!["https:", "http:", "data:", "blob:"].includes(parsed.protocol))
    throw new Error("ASSET_UNAVAILABLE: Unsupported asset URL")
  const network = new AbortController()
  const abort = () => network.abort(signal.reason)
  signal?.addEventListener("abort", abort, { once: true })
  if (signal?.aborted) abort()
  const timer = setTimeout(
    () => network.abort(new Error("ASSET_UNAVAILABLE: Asset download timed out")),
    30000
  )
  try {
    const response = await fetch(parsed, { signal: network.signal, credentials: "omit" })
    if (!response.ok || !response.body)
      throw new Error("ASSET_UNAVAILABLE: Asset is unavailable or blocked by CORS")
    if (Number(response.headers.get("content-length")) > maxBytes)
      throw new Error("LIMIT_EXCEEDED: asset size")
    const reader = response.body.getReader()
    const chunks = []
    let length = 0
    try {
      for (;;) {
        signal?.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > maxBytes) throw new Error("LIMIT_EXCEEDED: asset size")
        chunks.push(Buffer.from(value))
      }
    } catch (error) {
      await reader.cancel().catch(() => {})
      throw error
    }
    return {
      bytes: Buffer.concat(chunks, length),
      type: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream"
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  }
}
export const dataUrl = (bytes, type) =>
  `data:${type};base64,${Buffer.from(bytes).toString("base64")}`

/** Read bitmap headers before asking the browser to allocate decoded pixels. */
export function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.toString("hex", 0, 8) === "89504e470d0a1a0a")
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6)))
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) return null
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217 || marker === 218) return null
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (offset + 2 > bytes.length) return null
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) return null
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
        return length >= 7
          ? { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) }
          : null
      offset += length
    }
  }
  return null
}
