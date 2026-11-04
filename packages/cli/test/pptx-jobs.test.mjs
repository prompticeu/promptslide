import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"

import { createPptxJobs } from "../src/utils/pptx/jobs.mjs"

function request(
  manager,
  {
    method = "GET",
    url = "/__promptslide_exports",
    body,
    token,
    origin = "http://localhost:5173",
    remote = "127.0.0.1",
    host = "localhost:5173"
  } = {}
) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  Object.assign(req, {
    url,
    method,
    socket: { remoteAddress: remote },
    headers: {
      host,
      origin,
      "content-type": "application/json",
      ...(token ? { "x-promptslide-export": token } : {})
    }
  })
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v
      },
      end(bytes) {
        resolve({
          status: this.statusCode,
          bytes,
          headers: this.headers,
          json: () => JSON.parse(String(bytes))
        })
      }
    }
    manager.middleware(req, res, () => reject(new Error("Unexpected fallthrough"))).catch(reject)
  })
}
test("Studio export API rejects cross-origin and unauthenticated requests", async () => {
  const manager = createPptxJobs({ cwd: "/tmp", getBaseUrl: () => "http://127.0.0.1:5173" })
  try {
    assert.equal((await request(manager, { origin: "https://evil.example" })).status, 403)
    assert.equal((await request(manager, { remote: "10.0.0.2" })).status, 403)
    assert.equal((await request(manager, { host: "evil.example:5173" })).status, 403)
    assert.equal(
      (await request(manager, { method: "POST", url: "/__promptslide_exports/pptx", body: {} }))
        .status,
      403
    )
    const token = (await request(manager)).json().token
    assert.equal(
      (
        await request(manager, {
          token,
          method: "POST",
          url: "/__promptslide_exports/pptx",
          body: { path: "/etc/passwd" }
        })
      ).status,
      400
    )
    assert.equal(
      (
        await request(manager, {
          token,
          method: "POST",
          url: "/__promptslide_exports/pptx",
          body: {},
          origin: ""
        })
      ).status,
      403
    )
  } finally {
    await manager.close()
  }
})
test("explicit Tailscale bindings allow same-origin peers without allowing public or spoofed requests", async () => {
  const baseUrl = "http://100.80.230.94:5173"
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => baseUrl,
    run: async () => ({
      pptx: Buffer.from("tailnet-export"),
      report: { status: "succeeded", issues: [] }
    })
  })
  const peer = { host: "100.80.230.94:5173", origin: baseUrl, remote: "100.119.246.124" }
  try {
    const capability = await request(manager, peer)
    assert.equal(capability.status, 200)
    const token = capability.json().token
    assert.equal((await request(manager, { ...peer, remote: "203.0.113.5" })).status, 403)
    assert.equal((await request(manager, { ...peer, origin: "https://evil.example" })).status, 403)
    assert.equal((await request(manager, { ...peer, host: "evil.example:5173" })).status, 403)
    assert.equal((await request(manager, { ...peer, remote: "100.128.0.1" })).status, 403)
    assert.equal((await request(manager, { ...peer, remote: "100.63.255.255" })).status, 403)
    const created = await request(manager, {
      ...peer,
      token,
      method: "POST",
      url: "/__promptslide_exports/pptx",
      body: {}
    })
    assert.equal(created.status, 202)
    await manager.whenIdle()
    assert.equal(
      String(
        (
          await request(manager, {
            ...peer,
            token,
            url: `/__promptslide_exports/${created.json().jobId}/file`
          })
        ).bytes
      ),
      "tailnet-export"
    )
  } finally {
    await manager.close()
  }
  const localOnly = createPptxJobs({ cwd: "/tmp", getBaseUrl: () => "http://127.0.0.1:5173" })
  try {
    assert.equal((await request(localOnly, peer)).status, 403)
  } finally {
    await localOnly.close()
  }
})
test("Studio jobs expose progress, file and report and reject duplicate exports", async () => {
  let release
  const ready = new Promise(resolve => {
    release = resolve
  })
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => "http://127.0.0.1:5173",
    run: async ({ onProgress }) => {
      onProgress({ phase: "rendering", completed: 1, total: 2 })
      await ready
      return {
        pptx: Buffer.from("pptx-bytes"),
        report: { status: "succeeded", issues: [], metrics: { nativeExactObjects: 2 } }
      }
    }
  })
  try {
    const token = (await request(manager)).json().token
    const created = await request(manager, {
      token,
      method: "POST",
      url: "/__promptslide_exports/pptx",
      body: {}
    })
    assert.equal(created.status, 202)
    const id = created.json().jobId
    const duplicate = await request(manager, {
      token,
      method: "POST",
      url: "/__promptslide_exports/pptx",
      body: {}
    })
    assert.equal(duplicate.status, 409)
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}/file` })).status,
      409
    )
    release()
    await manager.whenIdle()
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}` })).json().status,
      "succeeded"
    )
    assert.equal(
      String((await request(manager, { token, url: `/__promptslide_exports/${id}/file` })).bytes),
      "pptx-bytes"
    )
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}/report` })).json().metrics
        .nativeExactObjects,
      2
    )
  } finally {
    release()
    await manager.close()
  }
})
test("strict rejection returns a report without a file; expiry removes results", async () => {
  let time = 0
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => "http://127.0.0.1:5173",
    now: () => time,
    run: async () => ({
      report: {
        status: "rejected",
        issues: [{ code: "UNSUPPORTED_PAINT", message: "Needs image", severity: "warning" }]
      }
    })
  })
  try {
    const token = (await request(manager)).json().token
    const id = (
      await request(manager, {
        token,
        method: "POST",
        url: "/__promptslide_exports/pptx",
        body: { mode: "strict" }
      })
    ).json().jobId
    await manager.whenIdle()
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}/file` })).status,
      409
    )
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}/report` })).json().status,
      "rejected"
    )
    time = 16 * 60 * 1000
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}` })).status,
      404
    )
  } finally {
    await manager.close()
  }
})
test("cancellation aborts the worker and removes access to its artifacts", async () => {
  let aborted = false
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => "http://127.0.0.1:5173",
    run: ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true
            reject(signal.reason)
          },
          { once: true }
        )
        if (signal.aborted) {
          aborted = true
          reject(signal.reason)
        }
      })
  })
  try {
    const token = (await request(manager)).json().token
    const id = (
      await request(manager, {
        token,
        method: "POST",
        url: "/__promptslide_exports/pptx",
        body: {}
      })
    ).json().jobId
    assert.equal(
      (await request(manager, { token, method: "DELETE", url: `/__promptslide_exports/${id}` }))
        .status,
      200
    )
    await manager.whenIdle()
    assert.equal(aborted, true)
    assert.equal(
      (await request(manager, { token, url: `/__promptslide_exports/${id}` })).status,
      404
    )
  } finally {
    await manager.close()
  }
})

test("cancellation waits for cleanup and reserves the worker until it settles", async () => {
  let releaseCleanup, reportAbort
  const cleanup = new Promise(resolve => {
    releaseCleanup = resolve
  })
  const aborted = new Promise(resolve => {
    reportAbort = resolve
  })
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => "http://localhost:5173",
    run: async ({ signal }) => {
      await new Promise(resolve => {
        if (signal.aborted) resolve()
        else signal.addEventListener("abort", resolve, { once: true })
      })
      reportAbort()
      await cleanup
      throw signal.reason
    }
  })
  try {
    const token = (await request(manager)).json().token
    const submit = () =>
      request(manager, { token, method: "POST", url: "/__promptslide_exports/pptx", body: {} })
    const id = (await submit()).json().jobId
    let cancellationFinished = false
    const cancellation = request(manager, {
      token,
      method: "DELETE",
      url: `/__promptslide_exports/${id}`
    }).then(response => {
      cancellationFinished = true
      return response
    })
    await aborted
    assert.equal(cancellationFinished, false)
    assert.equal(
      (await submit()).status,
      409,
      "A removed job can still own a browser during cleanup"
    )
    releaseCleanup()
    assert.equal((await cancellation).status, 200)
    assert.equal((await submit()).status, 202, "Retry is available once cancellation completes")
  } finally {
    releaseCleanup()
    await manager.close()
  }
})

test("concurrent submissions reserve one worker and malformed tokens fail safely", async () => {
  let release
  const ready = new Promise(resolve => {
    release = resolve
  })
  let calls = 0
  const manager = createPptxJobs({
    cwd: "/tmp",
    getBaseUrl: () => "http://localhost:5173",
    run: async () => {
      calls++
      await ready
      return { pptx: Buffer.from("ok"), report: { status: "succeeded", issues: [] } }
    }
  })
  try {
    assert.equal(
      (await request(manager, { token: "é".repeat(64), url: "/__promptslide_exports/unknown" }))
        .status,
      403
    )
    const token = (await request(manager)).json().token
    const submissions = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(manager, { token, method: "POST", url: "/__promptslide_exports/pptx", body: {} })
      )
    )
    assert.deepEqual(submissions.map(r => r.status).sort(), [202, 409, 409])
    release()
    await manager.whenIdle()
    assert.equal(calls, 1)
  } finally {
    release()
    await manager.close()
  }
})
