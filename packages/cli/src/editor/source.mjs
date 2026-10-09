import { createHash } from "node:crypto"

import ts from "typescript"

export const revision = text => createHash("sha256").update(text).digest("hex")
export function parse(text) {
  const file = ts.createSourceFile(
    "slide.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  if (file.parseDiagnostics.length)
    throw new Error(
      "Invalid TSX: " + ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, "\n")
    )
  return file
}
function nodes(file) {
  const result = []
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) result.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}
const opening = node => (ts.isJsxElement(node) ? node.openingElement : node)
const literal = node => node && (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
function jsxText(raw) {
  const compiled = ts.transpileModule(`const value = <p>${raw}</p>`, {
    compilerOptions: { jsx: ts.JsxEmit.React }
  }).outputText
  const parsed = ts.createSourceFile("text.js", compiled, ts.ScriptTarget.Latest, true)
  const call = parsed.statements[0]?.declarationList?.declarations[0]?.initializer
  return call?.arguments?.[2]?.text ?? ""
}
function textTarget(node) {
  if (!ts.isJsxElement(node)) return null
  if (node.children.every(child => ts.isJsxText(child)))
    return {
      start: node.openingElement.end,
      end: node.closingElement.getStart(),
      value: jsxText(node.children.map(c => c.text).join(""))
    }
  if (
    node.children.length === 1 &&
    ts.isJsxExpression(node.children[0]) &&
    literal(node.children[0].expression)
  ) {
    const child = node.children[0]
    return { start: child.getStart(), end: child.end, value: child.expression.text }
  }
  return null
}
// Only direct local array.map(item => JSX) with literal object fields is supported.
// Ambiguous bindings, spreads, computed expressions and imported data remain read-only.
function arrayText(node) {
  if (!ts.isJsxElement(node)) return null
  const children = node.children.filter(c => !ts.isJsxText(c) || c.text.trim())
  if (children.length !== 1 || !ts.isJsxExpression(children[0])) return null
  const expr = children[0].expression
  if (!expr || !ts.isPropertyAccessExpression(expr) || !ts.isIdentifier(expr.expression))
    return null
  let callback = node.parent
  while (callback && !ts.isArrowFunction(callback)) callback = callback.parent
  if (!callback || callback.parameters[0]?.name.getText() !== expr.expression.text) return null
  const call = callback.parent
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== "map" ||
    !ts.isIdentifier(call.expression.expression)
  )
    return null
  const name = call.expression.expression.text
  const declarations = []
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name)
      declarations.push(n)
    ts.forEachChild(n, visit)
  }
  visit(node.getSourceFile())
  if (
    declarations.length !== 1 ||
    !declarations[0].initializer ||
    !ts.isArrayLiteralExpression(declarations[0].initializer)
  )
    return null
  const items = declarations[0].initializer.elements.map((item, index) => {
    if (!ts.isObjectLiteralExpression(item) || item.properties.some(p => ts.isSpreadAssignment(p)))
      return null
    const props = item.properties.filter(
      p =>
        ts.isPropertyAssignment(p) &&
        (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
        p.name.text === expr.name.text
    )
    if (props.length !== 1 || !ts.isStringLiteral(props[0].initializer)) return null
    const value = props[0].initializer
    return { item: index, start: value.getStart(), end: value.end, value: value.text }
  })
  if (items.some(item => !item)) return null
  return { expression: `${name}.indexOf(${expr.expression.text})`, items }
}
// Resolve simple local component props to the DOM text node that renders them.
function propTargets(file, name) {
  const component = file.statements.find(
    statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name
  )
  const parameter = component?.parameters[0]?.name
  if (!parameter || !ts.isObjectBindingPattern(parameter)) return {}
  const targets = {}
  for (const binding of parameter.elements) {
    if (!ts.isIdentifier(binding.name) || binding.dotDotDotToken) continue
    const prop = binding.propertyName?.getText(file) || binding.name.text
    const matches = nodes(component).filter(node => {
      if (!ts.isJsxElement(node) || !/^[a-z]/.test(opening(node).tagName.getText(file)))
        return false
      const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim())
      return (
        children.length === 1 &&
        ts.isJsxExpression(children[0]) &&
        ts.isIdentifier(children[0].expression ?? {}) &&
        children[0].expression.text === binding.name.text
      )
    })
    if (matches.length === 1) targets[prop] = matches[0].getStart()
  }
  return targets
}
export function describe(text) {
  const file = parse(text)
  return nodes(file).map(node => {
    const open = opening(node)
    const props = {}
    for (const attr of open.attributes.properties) {
      if (!ts.isJsxAttribute(attr)) continue
      const value = attr.initializer
      if (ts.isStringLiteral(value ?? {})) props[attr.name.text] = value.text
      else if (value && ts.isJsxExpression(value) && literal(value.expression))
        props[attr.name.text] = value.expression.text
    }
    return {
      start: node.getStart(),
      tag: open.tagName.getText(file),
      line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: textTarget(node)?.value ?? null,
      computedText:
        ts.isJsxElement(node) &&
        !textTarget(node) &&
        !arrayText(node) &&
        node.children.some(
          child => ts.isJsxExpression(child) && child.expression && !literal(child.expression)
        ),
      items: arrayText(node)?.items,
      props,
      propTargets: propTargets(file, open.tagName.getText(file)),
      structural: ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent),
      container: ts.isJsxElement(node)
    }
  })
}
export function instrument(text, path) {
  const file = parse(text)
  const hash = revision(text)
  const patches = []
  const icons = new Set()
  const iconNamespaces = new Set()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== "lucide-react")
      continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings))
      for (const specifier of bindings.elements) {
        const imported = (specifier.propertyName || specifier.name).text
        if (/^[A-Z]/.test(imported)) icons.add(specifier.name.text)
      }
    else if (bindings && ts.isNamespaceImport(bindings)) iconNamespaces.add(bindings.name.text)
  }
  for (const node of nodes(file)) {
    const open = opening(node)
    const name = open.tagName.getText(file)
    const isIcon =
      icons.has(name) ||
      (ts.isPropertyAccessExpression(open.tagName) &&
        iconNamespaces.has(open.tagName.expression.getText(file)) &&
        /^[A-Z]/.test(open.tagName.name.text))
    if (!/^(?:[a-z][\w-]*|motion\.[a-z]+)$/.test(name) && !isIcon) continue
    patches.push({
      start: open.tagName.end,
      end: open.tagName.end,
      value: ` data-ps-source={${JSON.stringify(JSON.stringify([path, node.getStart(), hash]))}}${arrayText(node) ? ` data-ps-item={${arrayText(node).expression}}` : ""}`
    })
  }
  return apply(text, patches)
}
function apply(text, patches) {
  patches.sort((a, b) => b.start - a.start || b.end - a.end)
  let boundary = text.length
  for (const patch of patches) {
    if (patch.end > boundary)
      throw new Error("Overlapping edits: save child edits before changing its parent structure.")
    text = text.slice(0, patch.start) + patch.value + text.slice(patch.end)
    boundary = patch.start
  }
  return text
}
function styleCode(style) {
  if (!style || typeof style !== "object" || Array.isArray(style)) throw new Error("Invalid styles")
  for (const [key, value] of Object.entries(style)) {
    if (
      !/^(--[\w-]+|[a-zA-Z][a-zA-Z0-9]*)$/.test(key) ||
      !["string", "number"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value))
    )
      throw new Error("Invalid style value")
  }
  return Object.entries(style)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")
}
export function editSource(text, edits) {
  const file = parse(text)
  const all = nodes(file)
  const patches = []
  for (const edit of edits) {
    const node = all.find(n => n.getStart() === edit.start)
    if (!node) throw new Error("Source element no longer exists")
    const open = opening(node)
    if (edit.props && Object.hasOwn(edit.props, "style"))
      throw new Error("Use the structured style operation")
    const attrEdits = { ...edit.props }
    if (edit.style) {
      const attr = open.attributes.properties.find(
        a => ts.isJsxAttribute(a) && a.name.text === "style"
      )
      const original = attr?.initializer
      const expression =
        original && ts.isJsxExpression(original) ? original.expression?.getText(file) : null
      attrEdits.style = { code: `{ ...(${expression || "{}"}), ${styleCode(edit.style)} }` }
    }
    for (const [name, value] of Object.entries(attrEdits)) {
      if (!["style", "title", "subtitle", "eyebrow", "src", "alt", "className"].includes(name))
        throw new Error("Unsupported property")
      if (name !== "style" && typeof value !== "string") throw new Error("Property must be text")
      if (
        name === "src" &&
        !/^(https?:\/\/|\/|\.\.?\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(value)
      )
        throw new Error("Use an image URL or a local public path")
      const attr = open.attributes.properties.find(
        a => ts.isJsxAttribute(a) && a.name.text === name
      )
      if (attr && name !== "style") {
        const init = attr.initializer
        if (
          !init ||
          !(ts.isStringLiteral(init) || (ts.isJsxExpression(init) && literal(init.expression)))
        )
          throw new Error("Computed properties cannot be overwritten. Edit their source instead.")
      }
      const code = name === "style" ? value.code : JSON.stringify(value)
      patches.push({
        start: attr ? attr.getStart() : open.attributes.end,
        end: attr ? attr.end : open.attributes.end,
        value: `${attr ? "" : " "}${name}={${code}}`
      })
    }
    if (edit.text !== undefined || edit.richText) {
      const target =
        edit.item !== undefined
          ? arrayText(node)?.items.find(i => i.item === edit.item)
          : textTarget(node)
      if (!target)
        throw new Error(
          "Computed or mixed content cannot be replaced. Select a literal child or edit its source."
        )
      if (edit.item !== undefined && edit.richText)
        throw new Error("Range formatting requires a literal JSX text node")
      let value =
        edit.item !== undefined
          ? JSON.stringify(String(edit.text ?? target.value))
          : `{${JSON.stringify(String(edit.text ?? target.value))}}`
      if (edit.richText) {
        const { from, to, style } = edit.richText
        if (
          !Number.isInteger(from) ||
          !Number.isInteger(to) ||
          from < 0 ||
          to <= from ||
          to > target.value.length
        )
          throw new Error("Select a valid text range")
        value = `{${JSON.stringify(target.value.slice(0, from))}}<span style={{${styleCode(style)}}}>{${JSON.stringify(target.value.slice(from, to))}}</span>{${JSON.stringify(target.value.slice(to))}}`
      }
      patches.push({ ...target, value })
    }
    if (edit.action === "delete" || edit.action === "duplicate") {
      if (!ts.isJsxElement(node.parent) && !ts.isJsxFragment(node.parent))
        throw new Error("Only direct JSX children can be deleted or duplicated")
      const copies = edit.copies ?? 1
      if (!Number.isInteger(copies) || copies < 1 || copies > 100)
        throw new Error("Choose between 1 and 100 copies")
      const duplicate =
        edit.action === "duplicate"
          ? editSource(node.getText(file), [
              { ...edit, start: 0, action: undefined, copies: undefined }
            ])
          : ""
      patches.push({
        start: edit.action === "delete" ? node.getStart() : node.end,
        end: node.end,
        value: edit.action === "delete" ? "" : ("\n" + duplicate).repeat(copies)
      })
    }
    if (edit.insert) {
      if (!ts.isJsxElement(node)) throw new Error("Select a container for insertion")
      const kinds = {
        text: '<p style={{position:"absolute",left:80,top:80,fontSize:32}}>{"New text"}</p>',
        shape:
          '<div style={{position:"absolute",left:80,top:80,width:240,height:160,backgroundColor:"var(--primary)"}} />',
        image:
          '<img src="https://placehold.co/640x360/png" alt="New image" style={{position:"absolute",left:80,top:80,width:320,height:180,objectFit:"cover"}} />'
      }
      if (!kinds[edit.insert]) throw new Error("Unknown insertion type")
      patches.push({
        start: node.closingElement.getStart(),
        end: node.closingElement.getStart(),
        value: kinds[edit.insert]
      })
    }
  }
  const result = apply(text, patches)
  parse(result)
  return result
}
