import {
  Pencil,
  Check,
  X,
  Undo2,
  Redo2,
  MousePointer2,
  Type,
  Image as ImageIcon,
  Shapes,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ArrowUpToLine,
  ArrowDownToLine,
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  Layers,
  MoveHorizontal,
  MoveVertical,
  RotateCw
} from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { aligned, snap, type Rect } from "./geometry"
import "./studio.css"

type Style = Record<string, string | number>
type SourceNode = {
  items?: { item: number; value: string }[]
  start: number
  tag: string
  line: number
  computedText?: boolean
  text: string | null
  propTargets?: Record<string, number>
  props: Record<string, string>
  structural: boolean
  container: boolean
}
type Source = { revision: string; nodes: SourceNode[] }
type Edit = {
  item?: number
  start: number
  style?: Style
  text?: string
  props?: Record<string, string>
  action?: "delete" | "duplicate"
  copies?: number
  insert?: string
  richText?: { from: number; to: number; style: Style }
}
type Draft = Record<string, { revision: string; edits: Edit[] }>
type Selection = {
  item?: number
  path: string
  start: number
  revision: string
  element?: HTMLElement
  node?: SourceNode
  textProp?: string
}
const sourceOf = (element: HTMLElement): Selection | null => {
  try {
    const [path, start, revision] = JSON.parse(element.dataset.psSource!)
    return {
      path,
      start,
      revision,
      element,
      item: element.dataset.psItem === undefined ? undefined : Number(element.dataset.psItem)
    }
  } catch {
    return null
  }
}
const keyOf = (s: Selection) => `${s.path}:${s.start}:${s.item ?? "all"}`
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
function Studio({
  token,
  close,
  panel,
  overlay,
  surface
}: {
  token: string
  close: () => void
  panel: HTMLElement
  overlay: HTMLElement
  surface: HTMLElement
}) {
  const [index, setIndex] = useState(Number(surface.dataset.slideIndex || 0))
  const [tab, setTab] = useState<"design" | "arrange">("design")
  const [selected, setSelected] = useState<Selection[]>([])
  const [sources, setSources] = useState<Record<string, Source>>({})
  const [sharedAppearanceEnabled, setSharedAppearanceEnabled] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("promptslide:editor-draft") || "{}")
    } catch {
      return {}
    }
  })
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [past, setPast] = useState<Draft[]>([])
  const [future, setFuture] = useState<Draft[]>([])
  const [message, setMessage] = useState("All changes saved")
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useState(1)
  const [version, setVersion] = useState(0)
  const [, redraw] = useState(0)
  const [layers, setLayers] = useState<Selection[]>([])
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [confirmClose, setConfirmClose] = useState(false)
  const [closeError, setCloseError] = useState("")
  const closeDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (confirmClose) closeDialog.current?.showModal()
    else closeDialog.current?.close()
  }, [confirmClose])
  const [inlineText, setInlineText] = useState<string | null>(null)
  const canvas = useRef<HTMLElement>(surface)
  canvas.current = surface
  const touched = useRef(new Set<HTMLElement>())
  const copies = useRef<Element[]>([])
  function clearCopies() {
    copies.current.forEach(element => element.remove())
    copies.current = []
  }
  useEffect(() => clearCopies, [])
  const textArea = useRef<HTMLTextAreaElement>(null)
  const originals = useRef(
    new Map<
      HTMLElement,
      { style: string | null; html: string; src: string | null; hidden: boolean; source?: string }
    >()
  )
  const current = selected[0]
  const currentNode = current && sources[current.path]?.nodes.find(n => n.start === current.start)
  const currentItem = currentNode?.items?.find(item => item.item === current?.item)
  const currentText = current?.textProp
    ? currentNode?.props[current.textProp]
    : (currentItem?.value ?? currentNode?.text)
  const unsupportedSelection = selected.some(
    selection =>
      sources[selection.path]?.nodes.find(node => node.start === selection.start)?.computedText
  )

  const sharedEdit =
    current &&
    draft[current.path]?.edits.find(e => e.start === current.start && e.item === undefined)
  const itemEdit =
    currentItem &&
    current &&
    draft[current.path]?.edits.find(e => e.start === current.start && e.item === current.item)
  const formattingSource = current?.element && sourceOf(current.element)
  const formattingEdit =
    formattingSource &&
    draft[formattingSource.path]?.edits.find(
      edit => edit.start === formattingSource.start && edit.item === undefined
    )
  const currentEdit =
    sharedEdit || itemEdit || formattingEdit
      ? {
          ...sharedEdit,
          ...itemEdit,
          text: current?.textProp
            ? sharedEdit?.props?.[current.textProp]
            : (itemEdit?.text ?? sharedEdit?.text),
          style: formattingEdit?.style ?? sharedEdit?.style
        }
      : undefined
  const dirty = Object.keys(draft).length > 0
  async function request(data: unknown) {
    const response = await fetch("/__promptslide_editor", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Promptslide-Editor": token },
      body: JSON.stringify(data)
    })
    const value = await response.json()
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "This slide changed elsewhere. Your changes are still here. Download a copy or discard them to use the latest version."
          : value.error || "We couldn't save those changes. Please try again."
      )
    return value
  }
  async function inspect(selection: Selection[]) {
    if (selection.some(item => item.element)) surface.focus({ preventScroll: true })
    panel.querySelector(".ps-panel-body")?.scrollTo({ top: 0, behavior: "instant" })
    if (selection[0] && !selection[0].element) setTab("design")
    setSharedAppearanceEnabled(false)
    setInlineText(null)
    setSelected(selection)
    try {
      const paths = [...new Set(selection.map(s => s.path))]
      const entries = await Promise.all(
        paths
          .filter(
            p =>
              !sources[p] ||
              selection.some(item => item.path === p && item.revision !== sources[p]?.revision)
          )
          .map(async path => [path, await request({ action: "inspect", path })] as const)
      )
      const resolved = { ...sources, ...Object.fromEntries(entries) } as Record<string, Source>
      setSources(resolved)
      setSelected(
        selection.map(item => {
          const file = resolved[item.path]
          const owners =
            file?.nodes.flatMap(node =>
              Object.entries(node.propTargets || {})
                .filter(([prop, start]) => start === item.start && node.props[prop] !== undefined)
                .map(([prop]) => ({ node, prop }))
            ) || []
          if (owners.length !== 1) return item
          return {
            ...item,
            start: owners[0]!.node.start,
            textProp: owners[0]!.prop,
            node: owners[0]!.node
          }
        })
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    }
  }
  function appearanceLocked(selection: Selection) {
    if (sharedAppearanceEnabled) return false
    if (selection.textProp) return true
    const origin = selection.element && sourceOf(selection.element)
    return Boolean(
      origin &&
      layers.filter(layer => layer.path === origin.path && layer.start === origin.start).length > 1
    )
  }
  function change(
    selections: Selection[],
    patch: Partial<Edit> | ((s: Selection) => Partial<Edit>)
  ) {
    if (
      !selections.length ||
      selections.some(
        selection =>
          sources[selection.path]?.nodes.find(node => node.start === selection.start)?.computedText
      )
    )
      return
    const next = clone(draftRef.current)
    for (const selection of selections) {
      let p = typeof patch === "function" ? patch(selection) : patch
      if (selection.textProp && p.text !== undefined)
        p = { ...p, text: undefined, props: { ...p.props, [selection.textProp]: p.text } }
      if ((p.style || p.action || p.insert || p.richText) && appearanceLocked(selection)) return
      const s =
        (p.style || p.action || p.insert) && selection.element
          ? sourceOf(selection.element) || selection
          : selection
      const file = (next[s.path] ||= { revision: s.revision, edits: [] })
      if (file.revision !== s.revision) {
        setMessage(
          "This slide changed elsewhere. Download your changes or discard them to use the latest version."
        )
        return
      }
      const item = p.text !== undefined ? s.item : undefined
      const edit =
        file.edits.find(e => e.start === s.start && e.item === item) ||
        file.edits[file.edits.push({ start: s.start, item }) - 1]!
      Object.assign(edit, {
        ...p,
        style: p.style ? { ...edit.style, ...p.style } : edit.style,
        props: p.props ? { ...edit.props, ...p.props } : edit.props
      })
    }
    const previous = clone(draftRef.current)
    setPast(p => [...p.slice(-99), previous])
    setFuture([])
    setDraft(next)
    setMessage("Unsaved changes")
  }
  function undo() {
    if (!past.length) return
    const previous = clone(draftRef.current)
    setFuture(f => [previous, ...f])
    setMessage(
      Object.keys(past[past.length - 1]!).length ? "Unsaved changes" : "No unsaved changes"
    )
    setDraft(past[past.length - 1]!)
    setPast(p => p.slice(0, -1))
  }
  function redo() {
    if (!future.length) return
    const previous = clone(draftRef.current)
    setPast(p => [...p, previous])
    setMessage(Object.keys(future[0]!).length ? "Unsaved changes" : "No unsaved changes")
    setDraft(future[0]!)
    setFuture(f => f.slice(1))
  }
  function restore() {
    clearCopies()
    for (const [el, original] of originals.current) {
      if (!touched.current.has(el)) continue
      if (original.style === null) el.removeAttribute("style")
      else el.setAttribute("style", original.style)
      if (!el.querySelector("[data-ps-source]") && el.innerHTML !== original.html)
        el.innerHTML = original.html
      if (original.src === null) el.removeAttribute("src")
      else el.setAttribute("src", original.src)
      el.hidden = original.hidden
    }
    touched.current.clear()
  }
  useEffect(() => {
    const hot = (
      import.meta as ImportMeta & {
        hot?: {
          on: (event: string, callback: () => void) => void
          off: (event: string, callback: () => void) => void
        }
      }
    ).hot
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setSelected([])
        setInlineText(null)
        setSources({})
        window.dispatchEvent(new Event("promptslide:editor-refresh"))
        setVersion(v => v + 1)
      }, 100)
    }
    hot?.on("vite:afterUpdate", refresh)
    return () => {
      clearTimeout(timer)
      hot?.off("vite:afterUpdate", refresh)
    }
  }, [])
  useLayoutEffect(() => {
    let frame = 0
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setScale(surface.getBoundingClientRect().width / 1280))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(surface.parentElement!)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [surface])
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIndex(Number(surface.dataset.slideIndex || 0))
        setSelected([])
        setInlineText(null)
        setVersion(v => v + 1)
      })
    }
    const observer = new MutationObserver(update)
    observer.observe(surface, {
      attributes: true,
      attributeFilter: ["data-slide-index"],
      childList: true
    })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [surface])
  useLayoutEffect(() => {
    const active = surface.querySelector(`[data-slide-render-index="${index}"]`) || surface
    const elements = Array.from(active.querySelectorAll<HTMLElement>("[data-ps-source]"))
    const previous = originals.current
    const next = new Map<
      HTMLElement,
      { style: string | null; html: string; src: string | null; hidden: boolean; source?: string }
    >()
    for (const el of elements) {
      const saved = previous.get(el)
      next.set(
        el,
        saved && saved.source === el.dataset.psSource
          ? saved
          : {
              style: el.getAttribute("style"),
              html: el.innerHTML,
              src: el.getAttribute("src"),
              hidden: el.hidden,
              source: el.dataset.psSource
            }
      )
    }
    originals.current = next
    setLayers(elements.map(sourceOf).filter((s): s is Selection => !!s))
  }, [surface, index, version])
  useLayoutEffect(() => {
    clearCopies()
    for (const [el, original] of originals.current) {
      if (!el.isConnected) continue
      if (touched.current.has(el)) {
        if (original.style === null) el.removeAttribute("style")
        else el.setAttribute("style", original.style)
        if (!el.querySelector("[data-ps-source]") && el.innerHTML !== original.html)
          el.innerHTML = original.html
        if (original.src === null) el.removeAttribute("src")
        else el.setAttribute("src", original.src)
        el.hidden = original.hidden
      }
      const s = sourceOf(el)
      if (!s) continue
      if (draft[s.path] && draft[s.path]!.revision !== s.revision) continue
      const shared = draft[s.path]?.edits.find(e => e.start === s.start && e.item === undefined)
      const item =
        s.item === undefined
          ? undefined
          : draft[s.path]?.edits.find(e => e.start === s.start && e.item === s.item)
      const edit = shared || item ? { ...shared, ...item, style: shared?.style } : undefined
      if (!edit) continue
      touched.current.add(el)
      if (edit.style) Object.assign(el.style, edit.style)
      if (edit.text !== undefined) el.textContent = edit.text
      if (edit.richText) {
        const value = el.textContent || "",
          { from, to, style } = edit.richText
        const span = document.createElement("span")
        span.textContent = value.slice(from, to)
        Object.assign(span.style, style)
        el.replaceChildren(
          document.createTextNode(value.slice(0, from)),
          span,
          document.createTextNode(value.slice(to))
        )
      }
      if (edit.props?.src) el.setAttribute("src", edit.props.src)
      if (edit.action === "delete") el.hidden = true
    }
    for (const [el] of originals.current) {
      const source = sourceOf(el)
      if (!source || !el.isConnected) continue
      const file = draft[source.path]
      const edit =
        file?.revision === source.revision
          ? file.edits.find(
              candidate => candidate.start === source.start && candidate.action === "duplicate"
            )
          : undefined
      if (!edit) continue
      let previous: Element = el
      for (let i = 0; i < (edit.copies ?? 1); i++) {
        const copy = el.cloneNode(true) as HTMLElement
        for (const node of [copy, ...copy.querySelectorAll("[data-ps-source]")]) {
          node.removeAttribute("data-ps-source")
          node.removeAttribute("data-ps-item")
          node.removeAttribute("id")
        }
        copy.style.pointerEvents = "none"
        previous.after(copy)
        copies.current.push(copy)
        previous = copy
      }
    }
    for (const [path, file] of Object.entries(draft)) {
      const source = sources[path]
      if (!source || source.revision !== file.revision) continue
      for (const edit of file.edits) {
        const node = source.nodes.find(candidate => candidate.start === edit.start)
        for (const [prop, value] of Object.entries(edit.props || {})) {
          const target = node?.propTargets?.[prop]
          if (target === undefined) continue
          const owners = source.nodes.filter(candidate =>
            Object.values(candidate.propTargets || {}).includes(target)
          )
          if (owners.length !== 1) continue
          for (const [element] of originals.current) {
            const origin = sourceOf(element)
            if (origin?.path === path && origin.start === target) {
              element.textContent = value
              touched.current.add(element)
            }
          }
        }
      }
    }
    redraw(value => value + 1)
  }, [draft, index, version, surface, sources])
  useEffect(() => {
    try {
      sessionStorage.setItem("promptslide:editor-draft", JSON.stringify(draft))
    } catch {
      /* Storage can be disabled. */
    }
  }, [draft])
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (Object.keys(draftRef.current).length) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", before)
    return () => window.removeEventListener("beforeunload", before)
  }, [])
  useEffect(() => {
    // Prevent the presentation's global keyboard handler from advancing behind the editor.
    const handler = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (confirmClose) return
      if (busy) return
      const input = (event.target as HTMLElement).closest("input,textarea,select,[contenteditable]")
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
        return
      }
      if (input) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        redo()
        return
      }
      if (event.key === "Escape") {
        setSelected([])
        setInlineText(null)
        return
      }
      if (event.key.startsWith("Arrow") && selected.length) {
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 1
        move(
          selected,
          event.key === "ArrowRight" ? amount : event.key === "ArrowLeft" ? -amount : 0,
          event.key === "ArrowDown" ? amount : event.key === "ArrowUp" ? -amount : 0
        )
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selected.length) return
        event.preventDefault()
        const deletable = selected.filter(selection => {
          const origin = selection.element && sourceOf(selection.element)
          return (
            origin &&
            !appearanceLocked(selection) &&
            sources[origin.path]?.nodes.find(node => node.start === origin.start)?.structural
          )
        })
        change(deletable, { action: "delete" })
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  })
  function rect(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect(),
      base = canvas.current!.getBoundingClientRect()
    return {
      x: (r.left - base.left) / scale,
      y: (r.top - base.top) / scale,
      width: r.width / scale,
      height: r.height / scale
    }
  }
  function translation(s: Selection) {
    const style = draftRef.current[s.path]?.edits.find(e => e.start === s.start)?.style
    const value = String(style?.translate || s.element?.style.translate || "0px 0px").split(" ")
    return [parseFloat(value[0]!) || 0, parseFloat(value[1]!) || 0]
  }
  function move(items: Selection[], dx: number, dy: number) {
    change(items, s => {
      const [x, y] = translation(s)
      return { style: { translate: `${x! + dx}px ${y! + dy}px` } }
    })
  }
  function gesture(
    event: React.PointerEvent,
    kind: "move" | "resize" | "rotate",
    target?: Selection
  ) {
    if (event.button !== 0 || busy || unsupportedSelection || (shared && !sharedAppearanceEnabled))
      return
    const items = target ? [target] : selected
    if (!items.length || !items.every(s => s.element)) return
    surface.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX,
      startY = event.clientY
    const initial = items.map(s => ({
      s,
      rect: rect(s.element!),
      translation: translation(s),
      rotate: parseFloat(s.element!.style.rotate) || 0,
      css: s.element!.getAttribute("style")
    }))
    const bounds = initial[0]!.rect
    let patches: Partial<Edit>[] = []
    const others = layers
      .filter(l => l.element && !items.some(s => s.element === l.element))
      .map(l => rect(l.element!))
    const update = (e: PointerEvent) => {
      let dx = (e.clientX - startX) / scale,
        dy = (e.clientY - startY) / scale
      if (kind === "move" && !e.altKey) {
        const snapped = snap({ ...bounds, x: bounds.x + dx, y: bounds.y + dy }, others, 6 / scale)
        dx = snapped.x - bounds.x
        dy = snapped.y - bounds.y
        setGuides({ x: snapped.guideX, y: snapped.guideY })
      }
      patches = initial.map(({ s, rect: r, translation: [x, y], rotate }) => {
        const style: Style =
          kind === "move"
            ? { translate: `${x! + dx}px ${y! + dy}px` }
            : kind === "rotate"
              ? { rotate: `${rotate + dx / 2}deg` }
              : {
                  width: `${Math.max(8, r.width + dx)}px`,
                  height: `${Math.max(8, r.height + dy)}px`,
                  boxSizing: "border-box",
                  flexShrink: 0
                }
        Object.assign(s.element!.style, style)
        return { style }
      })
      redraw(value => value + 1)
    }
    const finish = (e: PointerEvent) => {
      window.removeEventListener("pointermove", update)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      setGuides({})
      if (e.type === "pointercancel") {
        for (const { s, css } of initial) {
          if (css === null) s.element!.removeAttribute("style")
          else s.element!.setAttribute("style", css)
        }
        return
      }
      if (patches.length) change(items, s => patches[items.indexOf(s)]!)
    }
    window.addEventListener("pointermove", update)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
  }
  async function save() {
    if (busy || !Object.keys(draftRef.current).length) return false
    setBusy(true)
    try {
      await request({
        action: "save",
        files: Object.entries(draftRef.current).map(([path, file]) => ({ path, ...file }))
      })
      setDraft({})
      setPast([])
      setFuture([])
      setSources({})
      setSelected([])
      setInlineText(null)
      setMessage("All changes saved")
      window.dispatchEvent(new Event("promptslide:editor-refresh"))
      setVersion(v => v + 1)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.")
      setCloseError(error instanceof Error ? error.message : "Could not save. Please try again.")
      return false
    } finally {
      setBusy(false)
    }
  }
  function discard() {
    restore()
    setDraft({})
    setPast([])
    setFuture([])
    setSelected([])
    setSources({})
    touched.current.clear()
    window.dispatchEvent(new Event("promptslide:editor-refresh"))
    setVersion(v => v + 1)
    setMessage("Changes discarded")
  }
  function exportDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "promptslide-editor-draft.json"
    a.click()
    URL.revokeObjectURL(url)
  }
  function align(axis: "x" | "y", mode: "start" | "center" | "end" | "distribute") {
    const items = selected.filter(s => s.element)
    if (items.length < 2) return
    const rects = items.map(s => rect(s.element!)),
      positions = aligned(rects, axis, mode)
    change(items, s => {
      const i = items.indexOf(s),
        [x, y] = translation(s),
        delta = positions[i]! - rects[i]![axis]
      return {
        style: {
          translate: `${x! + (axis === "x" ? delta : 0)}px ${y! + (axis === "y" ? delta : 0)}px`
        }
      }
    })
  }
  function beginInline() {
    if (current?.element && currentText !== null && currentText !== undefined)
      setInlineText(currentEdit?.text ?? currentText)
    else setMessage("Select a text box to edit it.")
  }
  function drillInto(event: { clientX: number; clientY: number }, item: Selection) {
    const descendant = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map(element => element.closest<HTMLElement>("[data-ps-source]"))
      .find(element => element && element !== item.element && item.element?.contains(element))
    const next = descendant && sourceOf(descendant)
    if (next) void inspect([next])
    else beginInline()
  }
  useEffect(() => {
    const clearOutside = (event: PointerEvent) => {
      const target = event.target
      if (
        confirmClose ||
        busy ||
        !(target instanceof Node) ||
        surface.contains(target) ||
        overlay.contains(target) ||
        panel.contains(target) ||
        (target instanceof Element && target.closest("[data-ps-viewer-toolbar]"))
      )
        return
      if (inlineText !== null && current && inlineText !== (currentEdit?.text ?? currentText))
        change([current], { text: inlineText })
      setInlineText(null)
      setSelected([])
      setGuides({})
    }
    document.addEventListener("pointerdown", clearOutside, true)
    return () => document.removeEventListener("pointerdown", clearOutside, true)
  })
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (busy) return
      event.preventDefault()
      event.stopPropagation()
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-ps-source]")
      if (!element) {
        setSelected([])
        return
      }
      const item = sourceOf(element)
      if (!item) return
      void inspect(
        event.shiftKey
          ? selected.some(s => s.element === element)
            ? selected.filter(s => s.element !== element)
            : [...selected, item]
          : [item]
      )
    }
    const doubleClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      beginInline()
    }
    surface.addEventListener("click", click, true)
    surface.addEventListener("dblclick", doubleClick, true)
    return () => {
      surface.removeEventListener("click", click, true)
      surface.removeEventListener("dblclick", doubleClick, true)
    }
  })
  function closeAfterResolution() {
    try {
      sessionStorage.removeItem("promptslide:editor-draft")
    } catch {
      /* Storage may be unavailable. */
    }
    close()
  }
  function finishEditing() {
    if (dirty) {
      setCloseError("")
      setConfirmClose(true)
      return
    }
    restore()
    close()
  }
  useEffect(() => {
    window.addEventListener("promptslide:editor-done", finishEditing)
    return () => window.removeEventListener("promptslide:editor-done", finishEditing)
  })
  const renderedText = currentEdit?.text ?? currentText ?? ""
  const computed = current?.element ? getComputedStyle(current.element) : undefined
  const css = (name: string, fallback = "") =>
    String(
      currentEdit?.style?.[name] ??
        (computed as unknown as Record<string, string> | undefined)?.[name] ??
        fallback
    )
  const number = (name: string, fallback = 0) => parseFloat(css(name)) || fallback
  const put = (style: Style) => {
    if (!shared || sharedAppearanceEnabled) change(selected, { style })
  }
  const selectionKind = current?.element ? elementKind(current.element) : "Text"
  const isText =
    selectionKind === "Text" ||
    selectionKind === "Heading" ||
    (currentText !== null && currentText !== undefined)
  const isImage = current?.element?.tagName === "IMG"
  const box = current?.element?.isConnected ? rect(current.element) : undefined
  const sharedCount = formattingSource
    ? layers.filter(
        item => item.path === formattingSource.path && item.start === formattingSource.start
      ).length
    : 0
  const componentAppearance = Boolean(current?.textProp)
  const shared = componentAppearance || sharedCount > 1
  const editingLocked = unsupportedSelection || selected.some(appearanceLocked)
  const renderedNode =
    formattingSource &&
    sources[formattingSource.path]?.nodes.find(node => node.start === formattingSource.start)
  const structureAllowed = Boolean(renderedNode?.structural) && !editingLocked
  function formatText(format: "bold" | "italic" | "underline") {
    const from = textArea.current?.selectionStart || 0,
      to = textArea.current?.selectionEnd || 0
    const style: Style =
      format === "bold"
        ? { fontWeight: Number(css("fontWeight", "400")) >= 600 ? 400 : 700 }
        : format === "italic"
          ? { fontStyle: css("fontStyle") === "italic" ? "normal" : "italic" }
          : {
              textDecoration: css("textDecorationLine").includes("underline") ? "none" : "underline"
            }
    if (
      to > from &&
      !currentItem &&
      currentEdit?.text === undefined &&
      current &&
      !current.textProp
    )
      change([current], { richText: { from, to, style } })
    else put(style)
  }
  function selectRelative(direction: "parent" | "child") {
    const element =
      direction === "parent"
        ? current?.element?.parentElement?.closest<HTMLElement>("[data-ps-source]")
        : current?.element?.querySelector<HTMLElement>("[data-ps-source]")
    const next = element && sourceOf(element)
    if (next) void inspect([next])
  }
  const selectedName = selected.length > 1 ? `${selected.length} elements` : selectionKind
  return (
    <>
      {confirmClose &&
        createPortal(
          <dialog
            ref={closeDialog}
            className="ps-close-dialog"
            aria-labelledby="ps-close-title"
            onCancel={event => {
              event.preventDefault()
              if (!busy) setConfirmClose(false)
            }}
          >
            <h2 id="ps-close-title">Save your changes?</h2>
            <p>
              You have unsaved changes to this deck. Save them before leaving the editor, or discard
              them.
            </p>
            {closeError && (
              <p role="alert" className="ps-close-error">
                {closeError}
              </p>
            )}
            <div className="ps-close-actions">
              <button disabled={busy} onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  discard()
                  closeAfterResolution()
                }}
              >
                Discard changes
              </button>
              <button
                className="ps-close-save"
                disabled={busy}
                onClick={async () => {
                  setCloseError("")
                  if (await save()) closeAfterResolution()
                }}
              >
                <Check size={14} />
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </dialog>,
          document.body
        )}
      {createPortal(
        <aside className="ps-panel" aria-label="Format panel">
          <div className="ps-panel-heading">
            <div>
              <span className="ps-overline">SLIDE EDITOR</span>
              <h2>{current ? selectedName : "Make it yours"}</h2>
            </div>
            <IconButton label="Done editing" disabled={busy} onClick={finishEditing}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="ps-panel-tools">
            <div className="ps-tabs" role="tablist" aria-label="Editing tools">
              <button role="tab" aria-selected={tab === "design"} onClick={() => setTab("design")}>
                Design
              </button>
              <button
                role="tab"
                disabled={
                  unsupportedSelection ||
                  (shared && !sharedAppearanceEnabled) ||
                  (!!current && !current.element)
                }
                aria-selected={tab === "arrange"}
                onClick={() => setTab("arrange")}
              >
                Arrange
              </button>
            </div>
            <IconButton label="Undo" disabled={!past.length || busy} onClick={undo}>
              <Undo2 size={16} />
            </IconButton>
            <IconButton label="Redo" disabled={!future.length || busy} onClick={redo}>
              <Redo2 size={16} />
            </IconButton>
          </div>
          {unsupportedSelection && (
            <section className="ps-selection-notice" role="status">
              <h3>Not directly editable</h3>
              <p>This element can’t be edited here yet. Select another element to make changes.</p>
              <button className="ps-text-button" onClick={() => selectRelative("parent")}>
                Select containing group
              </button>
            </section>
          )}
          <div className="ps-panel-body" inert={busy}>
            {!current ? (
              <div className="ps-empty">
                <div className="ps-empty-art" aria-hidden="true">
                  <div />
                  <div />
                  <div />
                  <MousePointer2 size={25} />
                </div>
                <h3>
                  Select something
                  <br />
                  on your slide
                </h3>
                <p>
                  Click text, an image, or a shape
                  <br />
                  to make it your own.
                </p>
                <span className="ps-shortcut">
                  Hold <kbd>Shift</kbd> to select several
                </span>
              </div>
            ) : unsupportedSelection ? null : (
              <>
                {shared && (
                  <section className="ps-shared" aria-label="Shared component">
                    <div className="ps-shared-heading">
                      <span className="ps-shared-icon">
                        <Layers size={16} />
                      </span>
                      <h3>Shared component</h3>
                      <span className="ps-shared-badge">
                        {sharedAppearanceEnabled ? "Editing" : "Locked"}
                      </span>
                    </div>
                    <p>
                      {componentAppearance || currentItem
                        ? "Edit the text for this item. Design changes apply wherever this component is used."
                        : "Design changes apply to every use of this element, including other slides."}
                    </p>
                    {!sharedAppearanceEnabled && (
                      <button
                        className="ps-shared-action"
                        aria-label="Edit shared component"
                        onClick={() => {
                          setSharedAppearanceEnabled(true)
                          setTab("design")
                        }}
                      >
                        <Pencil size={14} />
                        Edit shared component
                      </button>
                    )}
                  </section>
                )}
                {!current.element && (
                  <p className="ps-note">
                    Only the content fields below can be edited here. Select an element on the slide
                    to change its appearance.
                  </p>
                )}
                {tab === "design" ? (
                  <>
                    {currentText !== null && currentText !== undefined && (
                      <section className="ps-section">
                        <div className="ps-section-heading">
                          <h3>Text</h3>
                          <span>Double-click to edit on slide</span>
                        </div>
                        <textarea
                          className="ps-text-input"
                          aria-label="Text"
                          ref={textArea}
                          value={renderedText}
                          onChange={event => change([current], { text: event.target.value })}
                        />
                      </section>
                    )}
                    {currentNode &&
                      Object.entries(currentNode.props)
                        .filter(
                          ([name]) =>
                            name !== current.textProp &&
                            ["title", "subtitle", "eyebrow", "src", "alt"].includes(name)
                        )
                        .map(([name, value]) => (
                          <label className="ps-field" key={name}>
                            <span>
                              {
                                (
                                  {
                                    title: "Title",
                                    subtitle: "Subtitle",
                                    eyebrow: "Label",
                                    src: "Image address",
                                    alt: "Image description"
                                  } as Record<string, string>
                                )[name]
                              }
                            </span>
                            <input
                              value={currentEdit?.props?.[name] ?? value}
                              onChange={event =>
                                change([current], { props: { [name]: event.target.value } })
                              }
                            />
                          </label>
                        ))}
                    <fieldset
                      disabled={shared && !sharedAppearanceEnabled}
                      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                    >
                      {isText && current.element && (
                        <section className="ps-section">
                          <h3>Font</h3>
                          <div className="ps-font-row">
                            <label className="ps-field">
                              <span className="ps-sr-only">Font</span>
                              <select
                                aria-label="Font"
                                value={css("fontFamily").split(",")[0]!.replace(/"/g, "")}
                                onChange={event => put({ fontFamily: event.target.value })}
                              >
                                {Array.from(
                                  new Set([
                                    css("fontFamily").split(",")[0]!.replace(/"/g, ""),
                                    "Inter",
                                    "Arial",
                                    "Helvetica",
                                    "Georgia",
                                    "Times New Roman",
                                    "Courier New"
                                  ])
                                ).map(font => (
                                  <option key={font}>{font}</option>
                                ))}
                              </select>
                            </label>
                            <NumberField
                              label="Font size"
                              value={number("fontSize", 16)}
                              min={1}
                              onChange={value => put({ fontSize: `${value}px` })}
                            />
                          </div>
                          <div className="ps-format-row">
                            <div className="ps-segments">
                              <IconButton
                                label="Bold"
                                pressed={Number(css("fontWeight", "400")) >= 600}
                                onClick={() => formatText("bold")}
                              >
                                <Bold size={16} />
                              </IconButton>
                              <IconButton
                                label="Italic"
                                pressed={css("fontStyle") === "italic"}
                                onClick={() => formatText("italic")}
                              >
                                <Italic size={16} />
                              </IconButton>
                              <IconButton
                                label="Underline"
                                pressed={css("textDecorationLine").includes("underline")}
                                onClick={() => formatText("underline")}
                              >
                                <Underline size={16} />
                              </IconButton>
                            </div>
                            <div className="ps-segments">
                              {[
                                { value: "left", label: "Align text left", icon: AlignLeft },
                                { value: "center", label: "Center text", icon: AlignCenter },
                                { value: "right", label: "Align text right", icon: AlignRight }
                              ].map(({ value, label, icon: Icon }) => (
                                <IconButton
                                  key={value}
                                  label={label}
                                  pressed={css("textAlign") === value}
                                  onClick={() => put({ textAlign: value })}
                                >
                                  <Icon size={16} />
                                </IconButton>
                              ))}
                            </div>
                          </div>
                          <ColorField
                            label="Text color"
                            value={computed?.color || "#ffffff"}
                            onChange={color => put({ color })}
                          />
                          <div className="ps-palette">
                            <span>Deck colors</span>
                            {[
                              { name: "Accent", value: "var(--primary)" },
                              { name: "Text", value: "var(--foreground)" },
                              { name: "Muted", value: "var(--muted-foreground)" },
                              { name: "White", value: "#ffffff" },
                              { name: "Dark", value: "#171717" }
                            ].map(color => (
                              <button
                                key={color.name}
                                className="ps-swatch"
                                aria-label={`${color.name} text color`}
                                title={color.name}
                                style={{ background: color.value }}
                                onClick={() => put({ color: color.value })}
                              />
                            ))}
                          </div>
                          <details className="ps-details">
                            <summary>
                              Text spacing
                              <ChevronDown size={14} />
                            </summary>
                            <div className="ps-two-col">
                              <NumberField
                                label="Line spacing"
                                value={
                                  number("lineHeight", number("fontSize", 16) * 1.5) /
                                  number("fontSize", 16)
                                }
                                min={0.5}
                                step={0.1}
                                onChange={value => put({ lineHeight: value })}
                              />
                              <NumberField
                                label="Letter spacing"
                                value={number("letterSpacing")}
                                step={0.1}
                                onChange={value => put({ letterSpacing: `${value}px` })}
                              />
                            </div>
                          </details>
                        </section>
                      )}
                      {current.element && (
                        <section className="ps-section">
                          <h3>Appearance</h3>
                          {selectionKind === "Icon" && (
                            <>
                              <ColorField
                                label="Icon color"
                                value={css("color", "#ffffff")}
                                onChange={color => put({ color })}
                              />
                              <NumberField
                                label="Line thickness"
                                value={number("strokeWidth", 2)}
                                min={0.5}
                                step={0.5}
                                onChange={strokeWidth => put({ strokeWidth })}
                              />
                            </>
                          )}
                          <ColorField
                            label="Fill"
                            value={computed?.backgroundColor || "transparent"}
                            onChange={backgroundColor => put({ backgroundColor })}
                            clear={() => put({ backgroundColor: "transparent" })}
                          />
                          <div className="ps-two-col">
                            <NumberField
                              label="Corner rounding"
                              value={number("borderRadius")}
                              min={0}
                              onChange={value => put({ borderRadius: `${value}px` })}
                            />
                            <NumberField
                              label="Border width"
                              value={number("borderTopWidth")}
                              min={0}
                              onChange={value =>
                                put({ borderWidth: `${value}px`, borderStyle: "solid" })
                              }
                            />
                          </div>
                          {number("borderTopWidth") > 0 && (
                            <ColorField
                              label="Border color"
                              value={css("borderTopColor", "#ffffff")}
                              onChange={borderColor => put({ borderColor })}
                            />
                          )}
                          <label className="ps-range">
                            <span>
                              Opacity
                              <strong>{Math.round(Number(css("opacity", "1")) * 100)}%</strong>
                            </span>
                            <input
                              aria-label="Opacity"
                              type="range"
                              min={0}
                              max={100}
                              value={Math.round(Number(css("opacity", "1")) * 100)}
                              onChange={event => put({ opacity: Number(event.target.value) / 100 })}
                            />
                          </label>
                        </section>
                      )}
                      {isImage && (
                        <section className="ps-section">
                          <h3>Image</h3>
                          <label className="ps-field">
                            <span>Fit</span>
                            <select
                              aria-label="Image fit"
                              value={css("objectFit", "fill")}
                              onChange={event => put({ objectFit: event.target.value })}
                            >
                              <option value="cover">Fill the frame</option>
                              <option value="contain">Fit entire image</option>
                              <option value="fill">Stretch to fit</option>
                            </select>
                          </label>
                          <label className="ps-field">
                            <span>Focus</span>
                            <select
                              aria-label="Image focus"
                              value={css("objectPosition", "50% 50%")}
                              onChange={event => put({ objectPosition: event.target.value })}
                            >
                              {[
                                ["Center", "50% 50%"],
                                ["Top", "50% 0%"],
                                ["Bottom", "50% 100%"],
                                ["Left", "0% 50%"],
                                ["Right", "100% 50%"]
                              ].map(([name, value]) => (
                                <option value={value} key={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="ps-range">
                            <span>
                              Crop edges
                              <strong>
                                {parseFloat(css("clipPath").match(/inset\(([^%]+)/)?.[1] || "0")}%
                              </strong>
                            </span>
                            <input
                              aria-label="Crop edges"
                              type="range"
                              min={0}
                              max={45}
                              value={parseFloat(
                                css("clipPath").match(/inset\(([^%]+)/)?.[1] || "0"
                              )}
                              onChange={event => put({ clipPath: `inset(${event.target.value}%)` })}
                            />
                          </label>
                        </section>
                      )}
                      {current.element && (
                        <details className="ps-details ps-section">
                          <summary>
                            Spacing
                            <ChevronDown size={14} />
                          </summary>
                          <div className="ps-two-col">
                            {["Top", "Right", "Bottom", "Left"].map(side => (
                              <NumberField
                                key={side}
                                label={`Inside ${side.toLowerCase()}`}
                                value={number(`padding${side}`)}
                                min={0}
                                onChange={value => put({ [`padding${side}`]: `${value}px` })}
                              />
                            ))}
                          </div>
                          {["flex", "grid"].includes(css("display")) && (
                            <NumberField
                              label="Space between items"
                              value={number("gap")}
                              min={0}
                              onChange={value => put({ gap: `${value}px` })}
                            />
                          )}
                        </details>
                      )}
                      {!current.element && (
                        <p className="ps-note">Save to update this linked content on your slide.</p>
                      )}
                    </fieldset>
                  </>
                ) : (
                  <>
                    {box && (
                      <section className="ps-section">
                        <h3>Position & size</h3>
                        <div className="ps-two-col">
                          <NumberField
                            label="Horizontal position"
                            shortLabel="X"
                            value={box.x}
                            onChange={value => move(selected, value - box.x, 0)}
                          />
                          <NumberField
                            label="Vertical position"
                            shortLabel="Y"
                            value={box.y}
                            onChange={value => move(selected, 0, value - box.y)}
                          />
                          <NumberField
                            label="Width"
                            value={box.width}
                            min={1}
                            onChange={value =>
                              put({ width: `${value}px`, boxSizing: "border-box", flexShrink: 0 })
                            }
                          />
                          <NumberField
                            label="Height"
                            value={box.height}
                            min={1}
                            onChange={value =>
                              put({ height: `${value}px`, boxSizing: "border-box", flexShrink: 0 })
                            }
                          />
                        </div>
                        <NumberField
                          label="Rotation"
                          value={number("rotate")}
                          suffix="°"
                          onChange={value => put({ rotate: `${value}deg` })}
                        />
                      </section>
                    )}
                    <section className="ps-section">
                      <div className="ps-section-heading">
                        <h3>Align elements</h3>
                      </div>
                      <div className="ps-align-buttons">
                        {(
                          [
                            {
                              axis: "x",
                              mode: "start",
                              name: "Align left",
                              icon: AlignStartVertical
                            },
                            {
                              axis: "x",
                              mode: "center",
                              name: "Align horizontal centers",
                              icon: AlignCenterVertical
                            },
                            { axis: "x", mode: "end", name: "Align right", icon: AlignEndVertical },
                            {
                              axis: "y",
                              mode: "start",
                              name: "Align top",
                              icon: AlignStartHorizontal
                            },
                            {
                              axis: "y",
                              mode: "center",
                              name: "Align vertical centers",
                              icon: AlignCenterHorizontal
                            },
                            {
                              axis: "y",
                              mode: "end",
                              name: "Align bottom",
                              icon: AlignEndHorizontal
                            }
                          ] as const
                        ).map(({ axis, mode, name, icon: Icon }) => (
                          <IconButton
                            key={name}
                            label={name}
                            disabled={selected.length < 2}
                            onClick={() => align(axis, mode)}
                          >
                            <Icon size={19} />
                          </IconButton>
                        ))}
                      </div>
                      <div className="ps-two-col">
                        <button
                          className="ps-soft-button"
                          disabled={selected.length < 3}
                          onClick={() => align("x", "distribute")}
                        >
                          <MoveHorizontal size={16} />
                          Space across
                        </button>
                        <button
                          className="ps-soft-button"
                          disabled={selected.length < 3}
                          onClick={() => align("y", "distribute")}
                        >
                          <MoveVertical size={16} />
                          Space down
                        </button>
                      </div>
                      {selected.length < 2 && (
                        <p className="ps-note">Shift-click another element to align them.</p>
                      )}
                    </section>
                    <section className="ps-section">
                      <h3>Layer order</h3>
                      <div className="ps-two-col">
                        <button
                          className="ps-soft-button"
                          disabled={!current.element}
                          onClick={() =>
                            put({
                              position: css("position") === "static" ? "relative" : css("position"),
                              zIndex: number("zIndex") + 1
                            })
                          }
                        >
                          <ArrowUpToLine size={16} />
                          Bring forward
                        </button>
                        <button
                          className="ps-soft-button"
                          disabled={!current.element}
                          onClick={() =>
                            put({
                              position: css("position") === "static" ? "relative" : css("position"),
                              zIndex: number("zIndex") - 1
                            })
                          }
                        >
                          <ArrowDownToLine size={16} />
                          Send backward
                        </button>
                      </div>
                    </section>
                  </>
                )}
                {currentEdit?.action === "duplicate" && (
                  <p className="ps-note">Copy added. Save to edit copies separately.</p>
                )}
                <section className="ps-section ps-object-actions">
                  <button
                    className="ps-soft-button"
                    disabled={!structureAllowed}
                    onClick={() =>
                      change([current], {
                        action: "duplicate",
                        copies: (currentEdit?.copies ?? 0) + 1
                      })
                    }
                  >
                    <Copy size={15} />
                    Duplicate
                  </button>
                  <button
                    className="ps-soft-button ps-danger"
                    disabled={!structureAllowed}
                    onClick={() => change([current], { action: "delete" })}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                  {current.element && (
                    <button className="ps-text-button" onClick={() => selectRelative("parent")}>
                      Select group
                    </button>
                  )}
                </section>
                {renderedNode?.container && (
                  <details className="ps-details ps-section">
                    <summary>
                      <span>Add to this group</span>
                      <Plus size={14} />
                    </summary>
                    <div className="ps-insert-options">
                      {[
                        { kind: "text", name: "Text", icon: Type },
                        { kind: "shape", name: "Shape", icon: Shapes },
                        { kind: "image", name: "Image", icon: ImageIcon }
                      ].map(({ kind: insert, name, icon: Icon }) => (
                        <button
                          key={insert}
                          disabled={editingLocked}
                          onClick={() => change([current], { insert })}
                        >
                          <Icon size={20} />
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                    <p className="ps-note">New elements appear after you save.</p>
                  </details>
                )}
              </>
            )}
            <details className="ps-details ps-section">
              <summary>
                <span>Slide elements</span>
                <Layers size={14} />
              </summary>
              <div className="ps-layer-list">
                {layers
                  .filter(item => item.element?.getBoundingClientRect().height)
                  .map((item, i) => {
                    const element = item.element!,
                      kind = elementKind(element),
                      Icon =
                        kind === "Image"
                          ? ImageIcon
                          : kind === "Group"
                            ? Layers
                            : kind === "Shape" || kind === "Icon"
                              ? Shapes
                              : Type
                    return (
                      <button
                        key={`${keyOf(item)}:${i}`}
                        aria-pressed={selected.some(s => s.element === element)}
                        onClick={event =>
                          void inspect(
                            event.shiftKey
                              ? selected.some(s => s.element === element)
                                ? selected.filter(s => s.element !== element)
                                : [...selected, item]
                              : [item]
                          )
                        }
                      >
                        <Icon size={14} />
                        <span>
                          {kind === "Group" || kind === "Icon"
                            ? kind
                            : kind === "Image"
                              ? element.getAttribute("alt") || "Image"
                              : element.textContent?.trim().slice(0, 48) || "Shape"}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </details>
          </div>
          <footer className="ps-panel-footer">
            <div className="ps-save-status" role="status">
              <span className={dirty ? "ps-status-dot" : "ps-status-dot saved"} />
              <span>{busy ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
              {!dirty && <Check size={13} />}
            </div>
            {![
              "All changes saved",
              "Unsaved changes",
              "No unsaved changes",
              "Changes discarded"
            ].includes(message) ? (
              <p className="ps-error">
                {message}
                <button onClick={exportDraft}>Download your changes</button>
              </p>
            ) : null}
            <div className="ps-save-actions">
              <button className="ps-text-button" disabled={!dirty || busy} onClick={discard}>
                Discard
              </button>
              <button className="ps-save" disabled={!dirty || busy} onClick={() => void save()}>
                <Check size={14} />
                <span>{busy ? "Saving…" : "Save changes"}</span>
              </button>
            </div>
          </footer>
        </aside>,
        panel
      )}
      {createPortal(
        <div className="ps-edit-overlay">
          {selected.map((item, i) => {
            if (!item.element?.isConnected) return null
            if (inlineText !== null && item.element === current?.element) return null
            const r = rect(item.element)
            return (
              <div
                key={`${keyOf(item)}:${i}`}
                className={`ps-selection${editingLocked ? " ps-selection-locked" : ""}`}
                style={{
                  left: r.x * scale,
                  top: r.y * scale,
                  width: r.width * scale,
                  height: r.height * scale
                }}
                onDoubleClick={event => drillInto(event, item)}
                onPointerDown={event => gesture(event, "move")}
              >
                {!unsupportedSelection && (
                  <button
                    aria-label="Resize element"
                    disabled={editingLocked}
                    className="ps-resize"
                    onPointerDown={event => gesture(event, "resize", item)}
                  />
                )}
                {!unsupportedSelection && (
                  <button
                    aria-label="Rotate element"
                    disabled={editingLocked}
                    className="ps-rotate"
                    onPointerDown={event => gesture(event, "rotate", item)}
                  >
                    <RotateCw size={10} />
                  </button>
                )}
              </div>
            )
          })}
          {inlineText !== null &&
            current?.element &&
            (() => {
              const r = rect(current.element),
                style = getComputedStyle(current.element),
                fontSize = Math.max(12, parseFloat(style.fontSize) * scale),
                lineHeight = parseFloat(style.lineHeight) * scale || fontSize * 1.3
              return (
                <div
                  className="ps-inline-frame"
                  style={{
                    left: r.x * scale - 8,
                    top: r.y * scale - 8,
                    width: Math.ceil(Math.max(140, r.width * scale)) + 20
                  }}
                >
                  <div className={`ps-inline-hint${r.y * scale < 36 ? " below" : ""}`}>
                    <Pencil size={12} aria-hidden="true" />
                    <span>Editing text</span>
                    <span className="ps-inline-hint-detail">Click outside to apply</span>
                  </div>
                  <textarea
                    ref={element => {
                      if (!element) return
                      element.style.height = `${Math.max(lineHeight + 4, r.height * scale + 4, element.scrollHeight)}px`
                      if (document.activeElement !== element) element.focus()
                    }}
                    aria-label="Edit text inline"
                    className="ps-inline"
                    style={{
                      height: Math.max(lineHeight + 4, r.height * scale + 4),
                      fontFamily: style.fontFamily,
                      fontSize,
                      fontWeight: style.fontWeight,
                      fontStyle: style.fontStyle,
                      letterSpacing: parseFloat(style.letterSpacing) * scale || 0,
                      lineHeight: `${lineHeight}px`,
                      textAlign: style.textAlign as React.CSSProperties["textAlign"],
                      color: style.color
                    }}
                    value={inlineText}
                    onChange={event => setInlineText(event.target.value)}
                    onBlur={() => {
                      if (inlineText !== renderedText) change([current], { text: inlineText })
                      setInlineText(null)
                    }}
                  />
                </div>
              )
            })()}
          {guides.x !== undefined && (
            <div className="ps-guide vertical" style={{ left: guides.x * scale }} />
          )}
          {guides.y !== undefined && (
            <div className="ps-guide horizontal" style={{ top: guides.y * scale }} />
          )}
        </div>,
        overlay
      )}
    </>
  )
}

function IconButton({
  label,
  children,
  disabled,
  pressed,
  onClick
}: {
  label: string
  children: React.ReactNode
  disabled?: boolean
  pressed?: boolean
  onClick: () => void
}) {
  return (
    <button
      className="ps-icon-button"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
function NumberField({
  label,
  shortLabel,
  value,
  min,
  step = 1,
  suffix,
  onChange
}: {
  label: string
  shortLabel?: string
  value: number
  min?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="ps-field ps-number-field">
      <span>{shortLabel || label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
          onChange={event => {
            if (event.target.value !== "" && Number.isFinite(event.target.valueAsNumber))
              onChange(Math.max(min ?? -Infinity, event.target.valueAsNumber))
          }}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </label>
  )
}
function colorHex(value: string) {
  if (typeof document === "undefined") return "#ffffff"
  const context = document.createElement("canvas").getContext("2d")
  if (!context) return "#ffffff"
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const pixels = context.getImageData(0, 0, 1, 1).data
  return (
    "#" +
    Array.from(pixels.slice(0, 3))
      .map(channel => channel.toString(16).padStart(2, "0"))
      .join("")
  )
}
function ColorField({
  label,
  value,
  onChange,
  clear
}: {
  label: string
  value: string
  onChange: (value: string) => void
  clear?: () => void
}) {
  const transparent = value === "transparent" || value === "rgba(0, 0, 0, 0)"
  return (
    <div className="ps-color-field">
      <label>
        <span>{label}</span>
        <span className="ps-color-value">
          <span
            className={`ps-color-preview ${transparent ? "empty" : ""}`}
            style={{ background: transparent ? undefined : value }}
          />
          <span>{transparent ? "None" : colorHex(value).toUpperCase()}</span>
          <input
            type="color"
            aria-label={label}
            value={colorHex(value)}
            onChange={event => onChange(event.target.value)}
          />
        </span>
      </label>
      {clear && (
        <IconButton label="Remove fill" onClick={clear}>
          <X size={13} />
        </IconButton>
      )}
    </div>
  )
}
function elementKind(element: HTMLElement) {
  if (element.tagName.toLowerCase() === "svg") return "Icon"
  if (element.tagName === "IMG") return "Image"
  if (/^H[1-6]$/.test(element.tagName)) return "Heading"
  if (/^(P|SPAN|LABEL|LI|BLOCKQUOTE|STRONG|EM|B|I)$/.test(element.tagName)) return "Text"
  if (element.querySelector("[data-ps-source]")) return "Group"
  return element.textContent?.trim() ? "Text" : "Shape"
}
// Export only the component here: Fast Refresh keeps its draft and history intact.
export function EditorLauncher({
  token,
  initiallyOpen = false
}: {
  token: string
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const [mounted, setMounted] = useState(initiallyOpen)
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const timeout = window.setTimeout(
      () => setMounted(false),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200
    )
    return () => window.clearTimeout(timeout)
  }, [open])
  const [slots, setSlots] = useState<{
    toolbar: HTMLElement
    panel: HTMLElement
    overlay: HTMLElement
    surface: HTMLElement
  } | null>(null)
  useEffect(() => {
    const find = () => {
      const toolbar = document.querySelector<HTMLElement>("[data-ps-editor-toolbar]"),
        panel = document.querySelector<HTMLElement>("[data-ps-editor-panel]"),
        overlay = document.querySelector<HTMLElement>("[data-ps-editor-overlay]"),
        surface = document.querySelector<HTMLElement>("[data-ps-editor-canvas]")
      if (toolbar && panel && overlay && surface)
        setSlots(previous =>
          previous?.toolbar === toolbar &&
          previous.panel === panel &&
          previous.overlay === overlay &&
          previous.surface === surface
            ? previous
            : { toolbar, panel, overlay, surface }
        )
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(document.getElementById("root")!, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  const toggle = (value: boolean) => {
    setOpen(value)
    window.dispatchEvent(new CustomEvent("promptslide:editor-state", { detail: { open: value } }))
  }
  if (!slots) return null
  return (
    <>
      {createPortal(
        <button
          className={`ps-edit-action ${open ? "active" : ""}`}
          aria-label="Edit slide"
          title="Edit slide"
          aria-pressed={open}
          onClick={() => {
            if (!open) toggle(true)
            else window.dispatchEvent(new Event("promptslide:editor-done"))
          }}
        >
          <Pencil size={15} />
          {!open && <span>Edit</span>}
        </button>,
        slots.toolbar
      )}
      {mounted && <Studio token={token} close={() => toggle(false)} {...slots} />}
    </>
  )
}
