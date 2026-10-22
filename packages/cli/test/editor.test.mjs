import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join, posix, win32 } from "node:path"
import test from "node:test"

import { editorPlugin, sourceModulePath } from "../src/editor/plugin.mjs"
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
test("range formatting preserves pending wording and validates against its length", () => {
  const fixture = "const X = () => <p>Hello world</p>"
  const start = describe(fixture)[0].start
  const result = editSource(fixture, [
    { start, text: "Hello new world", richText: { from: 0, to: 5, style: { fontWeight: 700 } } }
  ])
  assert.equal(describe(result).find(n => n.tag === "span").text, "Hello")
  assert.ok(result.includes('{" new world"}'))
  const extended = editSource(fixture, [
    {
      start,
      text: "Hello new world",
      richText: { from: 10, to: 15, style: { fontStyle: "italic" } }
    }
  ])
  assert.equal(describe(extended).find(n => n.tag === "span").text, "world")
  assert.throws(
    () =>
      editSource(fixture, [
        { start, text: "Hi", richText: { from: 0, to: 5, style: { fontWeight: 700 } } }
      ]),
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
  const deleted = editSource(source, [
    {
      start: p,
      action: "delete",
      text: "changed",
      style: { translate: "20px 10px" },
      props: { title: "changed" }
    }
  ])
  assert.equal(
    describe(deleted).some(n => n.tag === "p"),
    false
  )
  assert.equal(describe(deleted).find(n => n.tag === "img").props.src, "/old.png")
  assert.equal(
    describe(editSource(source, [{ start: root, insert: "text" }])).filter(n => n.tag === "p")
      .length,
    2
  )
})
test("parent deletion supersedes descendant edits in either batch order and preserves sibling edits", () => {
  const fixture =
    "const X = () => <main><section><div><p>Hello</p></div></section><aside>Keep</aside></main>"
  const nodes = describe(fixture)
  const start = tag => nodes.find(n => n.tag === tag).start
  const descendantEdits = [
    { start: start("p"), text: "Changed", style: { color: "red" } },
    { start: start("div"), action: "delete" }
  ]
  const parentDelete = { start: start("section"), action: "delete" }
  const siblingEdit = { start: start("aside"), text: "Preserved" }
  for (const edits of [
    [...descendantEdits, parentDelete, siblingEdit],
    [parentDelete, siblingEdit, ...descendantEdits]
  ]) {
    const result = editSource(fixture, edits)
    assert.deepEqual(
      describe(result).map(n => n.tag),
      ["main", "aside"]
    )
    assert.equal(describe(result).find(n => n.tag === "aside").text, "Preserved")
  }
  assert.throws(
    () => editSource(fixture, [...descendantEdits, { start: start("main"), action: "delete" }]),
    /direct JSX children/
  )
  assert.throws(
    () => editSource(fixture, [parentDelete, { start: -1, text: "Missing" }]),
    /no longer exists/
  )
})

test("source module paths accept normalized Windows and POSIX IDs while excluding outside files", () => {
  for (const [paths, root] of [
    [win32, "C:\\deck"],
    [posix, "/deck"]
  ]) {
    const base = paths.join(root, "src")
    const file = paths.join(base, "slides", "a.tsx")
    assert.equal(sourceModulePath(base, file, paths), file)
    assert.equal(sourceModulePath(base, file.replaceAll("\\", "/") + "?v=1", paths), file)
    assert.equal(
      sourceModulePath(base, paths.join(base, "slides", "..", "a.jsx"), paths),
      paths.join(base, "a.jsx")
    )
    assert.equal(
      sourceModulePath(base, paths.join(base, "..allowed.tsx"), paths),
      paths.join(base, "..allowed.tsx")
    )
    for (const outside of [
      base,
      paths.join(base, "..", "outside.tsx"),
      paths.join(root, "src-other", "a.tsx"),
      paths.join(base, "a.ts"),
      paths.join(base, "a.css")
    ])
      assert.equal(sourceModulePath(base, outside, paths), undefined)
  }
  assert.equal(sourceModulePath("C:\\deck\\src", "D:/deck/src/a.tsx", win32), undefined)
})

test("editor transform instruments only normalized source module paths", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ps-editor-transform-")))
  try {
    const plugin = editorPlugin({ root })
    const filename = join(root, "src/slides/a.tsx")
    const result = plugin.transform(source, filename + "?v=1")
    assert.ok(result.code.includes("data-ps-source"))
    assert.equal(result.code, instrument(source, join("src", "slides", "a.tsx")))
    parse(result.code)
    assert.equal(plugin.transform(source, join(root, "src-other/a.tsx")), undefined)
    assert.equal(plugin.transform(source, join(root, "src/../outside.tsx")), undefined)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
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

test("array edits reject parameters, imports and declarations outside lexical scope", () => {
  const fixtures = [
    `const items = [{title: 'Unrelated'}]; function List({items}) { return <div>{items.map(item => <p>{item.title}</p>)}</div> }`,
    `const items = [{title: 'Unrelated'}]; function List(items) { return <div>{items.map(item => <p>{item.title}</p>)}</div> }`,
    `function Other() { const items = [{title: 'Unrelated'}] } const List = () => <div>{items.map(item => <p>{item.title}</p>)}</div>`,
    `import {items} from './data'; function Other() { const items = [{title: 'Unrelated'}] } const List = () => <div>{items.map(item => <p>{item.title}</p>)}</div>`,
    `const items = [{title: 'Unrelated'}]; function List(data) { const {items} = data; return <div>{items.map(item => <p>{item.title}</p>)}</div> }`
  ]
  for (const fixture of fixtures) {
    const paragraph = describe(fixture).find(n => n.tag === "p")
    assert.equal(paragraph.items, undefined)
    assert.equal(paragraph.computedText, true)
    assert.throws(
      () => editSource(fixture, [{ start: paragraph.start, item: 0, text: "Changed" }]),
      /Computed/
    )
    parse(instrument(fixture, "src/array.tsx"))
  }
})

test("array edits resolve the nearest local literal despite same-named outer declarations", () => {
  const fixture = `const items = [{title: 'Outer'}]; function List() { const items = [{title: 'Inner'}]; return <div>{items.map(item => <p>{item.title}</p>)}</div> }`
  const paragraph = describe(fixture).find(n => n.tag === "p")
  assert.equal(paragraph.items[0].value, "Inner")
  const result = editSource(fixture, [{ start: paragraph.start, item: 0, text: "Changed" }])
  assert.match(result, /title: 'Outer'/)
  assert.match(result, /title: "Changed"/)
  assert.doesNotMatch(result, /title: 'Inner'/)
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
  const { snap, aligned, translated } = await import(
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
  assert.equal(translated("none", 1, -1), "1px -1px")
  assert.equal(translated("20px 10px", 2, -3), "22px 7px")
  assert.equal(translated("-50% -50%", 1, 0), "calc(-50% + 1px) -50%")
  assert.equal(translated("-50%", 0, 2), "-50% 2px")
  assert.equal(
    translated("calc(-50% + 1px) -50%", -2, 3),
    "calc(calc(-50% + 1px) - 2px) calc(-50% + 3px)"
  )
  assert.equal(translated("10px 20px 30px", 1, 2), "11px 22px 30px")
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
