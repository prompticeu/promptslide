import { createInterface } from "node:readline"

import { dim } from "./ansi.mjs"

let _rl = null
let _closed = false

function getRL() {
  if (!_rl && !_closed) {
    _rl = createInterface({ input: process.stdin, output: process.stdout })
    _rl.on("close", () => {
      _rl = null
      _closed = true
    })
  }
  return _rl
}

export function closePrompts() {
  if (_rl) {
    _rl.close()
    _rl = null
  }
}

export function prompt(question, defaultValue) {
  const rl = getRL()
  if (!rl) return Promise.resolve(defaultValue || "")
  return new Promise(resolve => {
    const suffix = defaultValue ? ` ${dim(`(${defaultValue})`)} ` : " "
    const onClose = () => resolve(defaultValue || "")
    rl.once("close", onClose)
    rl.question(`  ${question}${suffix}`, answer => {
      rl.removeListener("close", onClose)
      resolve(answer.trim() || defaultValue || "")
    })
  })
}

export function confirm(question, defaultYes = true) {
  const rl = getRL()
  if (!rl) return Promise.resolve(defaultYes)
  return new Promise(resolve => {
    const hint = defaultYes ? "Y/n" : "y/N"
    const onClose = () => resolve(defaultYes)
    rl.once("close", onClose)
    rl.question(`  ${question} ${dim(`(${hint})`)} `, answer => {
      rl.removeListener("close", onClose)
      const a = answer.trim().toLowerCase()
      if (!a) return resolve(defaultYes)
      resolve(a === "y" || a === "yes")
    })
  })
}
