import assert from "node:assert/strict"
import test from "node:test"

import {
  accessTokenFromResponse,
  deviceRetryDelay,
  findLoginOrganization
} from "../src/commands/login.mjs"

test("device login accepts OAuth and camel-case token envelopes", () => {
  for (const response of [
    { access_token: "test-token" },
    { accessToken: "test-token" },
    { token: "test-token" },
    { data: { accessToken: "test-token" } },
    { data: { access_token: "test-token" } }
  ])
    assert.equal(accessTokenFromResponse(response), "test-token")
})
test("device login never treats an empty or malformed response as authentication", () => {
  for (const response of [
    null,
    {},
    { success: true },
    { data: {} },
    { access_token: "" },
    { token: 42 },
    { access_token: "   " }
  ])
    assert.throws(() => accessTokenFromResponse(response), /no access token/)
})

test("device login honors Retry-After and backs off when the registry omits it", () => {
  const now = Date.parse("2026-11-01T12:00:00Z")
  assert.equal(deviceRetryDelay("90", 5000, now), 90000)
  assert.equal(deviceRetryDelay("Sun, 01 Nov 2026 12:02:00 GMT", 5000, now), 120000)
  assert.equal(deviceRetryDelay("0", 5000, now), 5000)
  assert.equal(deviceRetryDelay(null, 5000, now), 60000)
  assert.equal(deviceRetryDelay("invalid", 60000, now), 120000)
})

test("non-interactive login selects the requested organization instead of the default account", () => {
  const personal = { id: "org-personal", slug: "personal", name: "Personal" }
  const company = { id: "org-company", slug: "promptic", name: "Promptic" }
  for (const selector of [company.id, company.slug, company.name])
    assert.equal(findLoginOrganization([personal, company], selector), company)
  assert.throws(() => findLoginOrganization([personal], "promptic"), /Organization not found/)
})
