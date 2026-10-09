import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { editorPlugin } from "../src/editor/plugin.mjs"
import { describe, editSource, instrument, parse, revision } from "../src/editor/source.mjs"
const source = `// keep this comment\nexport const Slide = () => <div className="flex"><p style={{ color: 'red' }}>Hello</p><img src="/old.png" /></div>\n`
const p = describe(source).find(n => n.tag === "p").start
const img = describe(source).find(n => n.tag === "img").start

test("instrumentation preserves valid JSX and original source locations", () => {
  const result = instrument(source, "src/slides/a.tsx")
  parse(result)
  assert.match(result, /data-ps-source=/)
  assert.match(result, /keep this comment/)
  assert.equal(describe(source).find(n => n.start === p).text, "Hello")
})
test("batched text, style and image edits preserve unrelated formatting", () => {
  const result = editSource(source, [
    { start: p, text: '<Hi> {world} " &', style: { fontSize: "32px" } },
    { start: img, props: { src: "/new.png" } }
  ])
  assert.ok(result.startsWith("// keep this comment\n"))
  assert.match(result, /color: 'red'/)
  assert.match(result, /fontSize/)
  assert.equal(describe(result).find(n => n.tag === "p").text, '<Hi> {world} " &')
  assert.equal(describe(result).find(n => n.tag === "img").props.src, "/new.png")
})
test("computed text and props are rejected", () => {
  const s = "const X=()=> <p title={getTitle()}>{value}</p>"
  const start = describe(s)[0].start
  assert.throws(() => editSource(s, [{ start, text: "replacement" }]), /Computed/)
  assert.throws(() => editSource(s, [{ start, props: { title: "replacement" } }]), /Computed/)
})
test("range formatting creates valid JSX without raw HTML injection", () => {
  const result = editSource(source, [
    { start: p, richText: { from: 1, to: 4, style: { fontWeight: 700 } } }
  ])
  assert.match(result, /<span style=/)
  parse(result)
  assert.throws(
    () => editSource(source, [{ start: p, richText: { from: -1, to: 4, style: {} } }]),
    /valid text range/
  )
})
test("safe structure operations and overlapping edits", () => {
  assert.equal(
    describe(editSource(source, [{ start: p, action: "duplicate" }])).filter(n => n.tag === "p")
      .length,
    2
  )
  assert.equal(
    describe(editSource(source, [{ start: p, action: "delete" }])).filter(n => n.tag === "p")
      .length,
    0
  )
  const root = describe(source)[0].start
  assert.throws(
    () => editSource(source, [{ start: root, action: "delete" }]),
    /direct JSX children/
  )
  assert.throws(
    () => editSource(source, [{ start: p, action: "delete", text: "changed" }]),
    /Overlapping/
  )
  assert.equal(
    describe(editSource(source, [{ start: root, insert: "text" }])).filter(n => n.tag === "p")
      .length,
    2
  )
})
test("source saving validates every file before writing, rejects stale revisions and escaped paths", async () => {
  const root = mkdtempSync(join(tmpdir(), "ps-editor-"))
  mkdirSync(join(root, "src"))
  const path = "src/a.tsx"
  writeFileSync(join(root, path), source)
  writeFileSync(join(root, "outside.tsx"), source)
  symlinkSync(join(root, "outside.tsx"), join(root, "src/link.tsx"))
  let middleware
  const plugin = editorPlugin({ root })
  assert.equal(plugin.apply, "serve")
  plugin.configureServer({
    middlewares: {
      use: (_path, handler) => {
        middleware = handler
      }
    }
  })
  const client = plugin.load("\0virtual:promptslide-editor")
  const tokenMatch = client.match(/mountEditor\(slides, theme, "([a-f0-9]{48})"/)
  assert.ok(tokenMatch, "Editor client must pass its per-server token to mountEditor")
  const token = tokenMatch[1]
  const call = (data, auth = token) =>
    new Promise(resolve => {
      const req = new EventEmitter()
      req.method = "POST"
      req.headers = { "x-promptslide-editor": auth }
      req.destroy = () => {}
      const res = {
        statusCode: 200,
        setHeader() {},
        end(body) {
          resolve({ status: this.statusCode, data: JSON.parse(body) })
        }
      }
      middleware(req, res)
      req.emit("data", JSON.stringify(data))
      req.emit("end")
    })
  try {
    assert.equal((await call({ action: "inspect", path }, "bad")).status, 403)
    assert.equal((await call({ action: "inspect", path: "src/link.tsx" })).status, 400)
    const before = await call({ action: "inspect", path })
    assert.equal(before.data.revision, revision(source))
    const file = { path, revision: revision(source), edits: [{ start: p, text: "Saved" }] }
    assert.equal(
      (await call({ action: "save", files: [file, { ...file, path: "src/missing.tsx" }] })).status,
      400
    )
    assert.equal(readFileSync(join(root, path), "utf8"), source)
    assert.equal((await call({ action: "save", files: [file] })).status, 200)
    assert.equal((await call({ action: "save", files: [file] })).status, 409)
    assert.equal(
      describe(readFileSync(join(root, path), "utf8")).find(n => n.tag === "p").text,
      "Saved"
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("local array text edits address individual items, not the shared JSX expression", () => {
  const fixture = `const items = [{title: 'First'}, {title: 'Second'}];const X = () => <div>{items.map(item => <p>{item.title}</p>)}</div>`
  const paragraph = describe(fixture).find(n => n.tag === "p")
  assert.equal(paragraph.items.length, 2)
  parse(instrument(fixture, "src/array.tsx"))
  const result = editSource(fixture, [{ start: paragraph.start, item: 1, text: "Changed" }])
  assert.match(result, /title: 'First'/)
  assert.match(result, /title: "Changed"/)
  assert.match(result, /\{item.title\}/)
})

test("JSX whitespace and entities round-trip as rendered text", () => {
  const fixture = "const X = () => <p>\n  Hello &middot; world\n</p>"
  assert.equal(describe(fixture)[0].text, "Hello · world")
})

test("structured style values cannot inject source code through props", () => {
  assert.throws(
    () => editSource(source, [{ start: p, props: { style: { code: "evil()" } } }]),
    /structured style/
  )
})

test("geometry snaps in design coordinates and distributes unequal element sizes", async () => {
  const ts = (await import("typescript")).default
  const code = ts.transpileModule(
    readFileSync(new URL("../src/editor/geometry.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } }
  ).outputText
  const { snap, aligned } = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  const snapped = snap({ x: 7, y: 348, width: 20, height: 20 }, [], 8)
  assert.equal(snapped.x, 0)
  assert.equal(snapped.y, 350)
  assert.equal(snapped.guideY, 360)
  const rects = [
    { x: 40, y: 0, width: 20, height: 10 },
    { x: 180, y: 0, width: 60, height: 10 },
    { x: 100, y: 0, width: 40, height: 10 }
  ]
  assert.deepEqual(aligned(rects, "x", "start"), [40, 40, 40])
  assert.deepEqual(aligned(rects, "x", "distribute"), [40, 180, 100])
  assert.deepEqual(aligned(rects, "x", "end"), [220, 180, 200])
})

test("Lucide icons including aliases and namespaces forward source metadata", () => {
  const input = `import {Presentation as DeckIcon} from "lucide-react";
import * as Icons from "lucide-react";
const Slide=()=> <div><DeckIcon/><Icons.Star/><OtherComponent/></div>`
  const output = instrument(input, "src/slide.tsx")
  parse(output)
  assert.match(output, /<DeckIcon data-ps-source=/)
  assert.match(output, /<Icons.Star data-ps-source=/)
  assert.doesNotMatch(output, /<OtherComponent data-ps-source=/)
  const start = describe(input).find(node => node.tag === "DeckIcon").start
  assert.match(
    editSource(input, [{ start, style: { color: "#123456", strokeWidth: 3 } }]),
    /strokeWidth/
  )
})
