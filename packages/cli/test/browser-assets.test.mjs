import assert from "node:assert/strict"
import test from "node:test"

import { imageDimensions } from "../src/browser/assets.mjs"
import { resolvePictures } from "../src/browser/capture.mjs"
import { decodeFont } from "../src/utils/pptx/fonts.mjs"

const pngHeader = (width, height) => {
  const bytes = Buffer.alloc(24)
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

async function withDocument(run) {
  const previous = globalThis.document
  globalThis.document = { baseURI: "https://example.test/deck/" }
  try {
    await run()
  } finally {
    if (previous === undefined) delete globalThis.document
    else globalThis.document = previous
  }
}
const picture = bytes => ({
  kind: "picture",
  box: { x: 0, y: 0, width: 1, height: 1 },
  payload: {
    url: "data:image/png;base64," + bytes.toString("base64"),
    naturalWidth: 1,
    naturalHeight: 1
  }
})

test("browser picture budget rejects new retained bytes before image decoding", async () => {
  await withDocument(async () => {
    const node = picture(pngHeader(1, 1))
    await assert.rejects(
      resolvePictures(null, { nodes: [node] }, { mediaBudget: { bytes: 50 * 1024 * 1024 } }),
      /LIMIT_EXCEEDED: retained picture bytes/
    )
    assert.equal(node.payload.data, undefined)
  })
})

test("actual bitmap dimensions override forged adapter metadata before decoding", async () => {
  await withDocument(async () => {
    const node = picture(pngHeader(100000, 100000))
    await assert.rejects(
      resolvePictures(null, { nodes: [node] }, {}),
      /LIMIT_EXCEEDED: decoded picture pixels/
    )
    assert.equal(node.payload.data, undefined)
  })
})

test("bitmap header dimensions include PNG, GIF and progressive JPEG", () => {
  assert.deepEqual(imageDimensions(pngHeader(17, 29)), { width: 17, height: 29 })
  const gif = Buffer.alloc(10)
  gif.write("GIF89a")
  gif.writeUInt16LE(12, 6)
  gif.writeUInt16LE(34, 8)
  assert.deepEqual(imageDimensions(gif), { width: 12, height: 34 })
  const jpeg = Buffer.from([255, 216, 255, 194, 0, 8, 8, 0, 34, 0, 12, 0])
  assert.deepEqual(imageDimensions(jpeg), { width: 12, height: 34 })
})

test("WOFF cumulative expansion is rejected before any table is decompressed", async () => {
  const bytes = Buffer.alloc(86)
  bytes.write("wOFF")
  bytes.writeUInt32BE(0x10000, 4)
  bytes.writeUInt16BE(2, 12)
  bytes.writeUInt32BE(16, 16)
  for (let index = 0; index < 2; index++) {
    const at = 44 + index * 20
    bytes.write(index ? "head" : "cmap", at)
    bytes.writeUInt32BE(84 + index, at + 4)
    bytes.writeUInt32BE(1, at + 8)
    bytes.writeUInt32BE(30 * 1024 * 1024, at + 12)
  }
  await assert.rejects(decodeFont(bytes), /Decoded font exceeds asset size limit/)
})
