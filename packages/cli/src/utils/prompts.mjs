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
    rl.question(`  ${question}${suffix}`, answer => {
      resolve(answer.trim() || defaultValue || "")
    })
    rl.once("close", () => resolve(defaultValue || ""))
  })
}

export function confirm(question, defaultYes = true) {
  const rl = getRL()
  if (!rl) return Promise.resolve(defaultYes)
  return new Promise(resolve => {
    const hint = defaultYes ? "Y/n" : "y/N"
    rl.question(`  ${question} ${dim(`(${hint})`)} `, answer => {
      const a = answer.trim().toLowerCase()
      if (!a) return resolve(defaultYes)
      resolve(a === "y" || a === "yes")
    })
    rl.once("close", () => resolve(defaultYes))
  })
}
