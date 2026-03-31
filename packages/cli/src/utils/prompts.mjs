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

/**
 * Arrow-key select prompt. Returns the index of the chosen option.
 * @param {string[]} options - Display labels for each option
 * @param {number} defaultIndex - Initially highlighted index
 * @returns {Promise<number>}
 */
export function select(options, defaultIndex = 0) {
  if (!process.stdin.isTTY) return Promise.resolve(defaultIndex)

  // Pause readline so we can use raw mode
  if (_rl) { _rl.pause() }

  return new Promise(resolve => {
    let cursor = defaultIndex
    const { stdin, stdout } = process

    const render = () => {
      // Move up to overwrite previous render (except first time)
      if (render._drawn) stdout.write(`\x1b[${options.length}A`)
      for (let i = 0; i < options.length; i++) {
        const prefix = i === cursor ? "  \x1b[36m❯\x1b[0m " : "    "
        const label = i === cursor ? `\x1b[1m${options[i]}\x1b[0m` : dim(options[i])
        stdout.write(`\x1b[2K${prefix}${label}\n`)
      }
      render._drawn = true
    }

    stdin.setRawMode(true)
    stdin.resume()
    render()

    const onData = (buf) => {
      const key = buf.toString()

      // Ctrl+C
      if (key === "\x03") {
        stdin.setRawMode(false)
        stdin.removeListener("data", onData)
        if (_rl) { _rl.resume() }
        process.exit(0)
      }

      // Up arrow or k
      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + options.length) % options.length
        render()
        return
      }

      // Down arrow or j
      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % options.length
        render()
        return
      }

      // Enter
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false)
        stdin.removeListener("data", onData)
        stdin.pause()
        if (_rl) { _rl.resume() }
        resolve(cursor)
      }
    }

    stdin.on("data", onData)
  })
}
