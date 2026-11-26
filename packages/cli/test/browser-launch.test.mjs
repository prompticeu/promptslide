import assert from "node:assert/strict"
import test from "node:test"

import { launchChromium } from "../src/utils/export.mjs"

const missing = () => new Error("Executable doesn't exist at /missing/chromium")

test("capture reuses a successful browser launch", async () => {
  const browser = {},
    calls = []
  const result = await launchChromium({
    launch: async options => {
      calls.push(options)
      return browser
    }
  })
  assert.equal(result, browser)
  assert.deepEqual(calls, [{ headless: true }])
})

test("capture tries installed Chrome before downloading and preserves launch options", async () => {
  const browser = {},
    calls = []
  const result = await launchChromium(
    {
      launch: async options => {
        calls.push(options)
        if (!options.channel) throw missing()
        return browser
      }
    },
    { headless: false, args: ["--test-option"] }
  )
  assert.equal(result, browser)
  assert.deepEqual(calls, [
    { headless: false, args: ["--test-option"] },
    { headless: false, args: ["--test-option"], channel: "chrome" }
  ])
})

test("capture respects explicit host executable and channel choices", async () => {
  for (const options of [{ executablePath: "/host/chromium" }, { channel: "chromium" }]) {
    let calls = 0
    await assert.rejects(
      launchChromium(
        {
          launch: async () => {
            calls++
            throw missing()
          }
        },
        options
      ),
      /Executable doesn't exist/
    )
    assert.equal(calls, 1)
  }
})

test("capture does not replace a browser crash with a different browser", async () => {
  let calls = 0
  await assert.rejects(
    launchChromium({
      launch: async () => {
        calls++
        throw new Error("Browser crashed")
      }
    }),
    /Browser crashed/
  )
  assert.equal(calls, 1)
})

test("capture stops before launch when already cancelled", async () => {
  const controller = new AbortController()
  const reason = new Error("Export cancelled")
  controller.abort(reason)
  await assert.rejects(
    launchChromium({ launch: async () => assert.fail("Must not launch") }, {}, controller.signal),
    error => error === reason
  )
})

test("capture cancellation prevents a fallback launch", async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(
    launchChromium(
      {
        launch: async () => {
          calls++
          controller.abort(new Error("Export cancelled"))
          throw missing()
        }
      },
      {},
      controller.signal
    ),
    /Export cancelled/
  )
  assert.equal(calls, 1)
})

test("capture reports an installed Chrome launch failure without downloading", async () => {
  let calls = 0
  await assert.rejects(
    launchChromium({
      launch: async options => {
        calls++
        if (!options.channel) throw missing()
        throw new Error("Chrome launch denied")
      }
    }),
    /Chrome launch denied/
  )
  assert.equal(calls, 2)
})
