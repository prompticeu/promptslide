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
