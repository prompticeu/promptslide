import { execSync } from "node:child_process"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { saveAuth, DEFAULT_REGISTRY } from "../utils/auth.mjs"
import { closePrompts } from "../utils/prompts.mjs"

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function openBrowser(url) {
  try {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open"
    execSync(`${cmd} "${url}"`, { stdio: "ignore" })
  } catch {}
}

export async function login(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("login")}`)
  console.log()

  // Parse --registry flag
  let registry = DEFAULT_REGISTRY
  const registryIdx = args.indexOf("--registry")
  if (registryIdx !== -1 && args[registryIdx + 1]) {
    registry = args[registryIdx + 1].replace(/\/$/, "")
  }

  console.log(`  Registry: ${cyan(registry)}`)
  console.log()

  // Step 1: Request device code
  let deviceData
  try {
    const res = await fetch(`${registry}/api/auth/device/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "promptslide-cli",
        scope: "openid profile email"
      })
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${res.status}: ${body}`)
    }

    deviceData = await res.json()
  } catch (err) {
    console.error(`  ${red("Error:")} Could not connect to registry.`)
    console.error(`  ${dim(err.message)}`)
    process.exit(1)
  }

  const { device_code, user_code, verification_uri_complete, verification_uri, interval: initialInterval } = deviceData
  let pollInterval = (initialInterval || 5) * 1000

  // Step 2: Show verification info
  const verifyUrl = verification_uri_complete || verification_uri || `${registry}/device`
  console.log(`  ${green("✓")} Open this URL in your browser:`)
  console.log(`    ${cyan(verifyUrl)}`)
  console.log()
  if (user_code) {
    console.log(`  Enter code: ${bold(user_code)}`)
    console.log()
  }
  console.log(`  ${dim("Waiting for authorization...")}`)

  openBrowser(verifyUrl)

  // Step 3: Poll for authorization
  let tokenData
  while (true) {
    await sleep(pollInterval)

    try {
      const res = await fetch(`${registry}/api/auth/device/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code,
          client_id: "promptslide-cli",
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      })

      const data = await res.json()

      if (data.error === "authorization_pending") continue
      if (data.error === "slow_down") {
        pollInterval += 5000
        continue
      }
      if (data.error) {
        throw new Error(data.error_description || data.error)
      }

      tokenData = data
      break
    } catch (err) {
      if (err.message === "authorization_pending") continue
      console.error(`\n  ${red("Error:")} ${err.message}`)
      process.exit(1)
    }
  }

  const accessToken = tokenData.access_token || tokenData.token

  // Step 4: Fetch session info (org membership etc.)
  let orgData = { organizationId: null, organizationName: null }
  try {
    const res = await fetch(`${registry}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (res.ok) {
      const session = await res.json()
      orgData.organizationId = session.session?.activeOrganizationId || null
      orgData.organizationName = session.session?.activeOrganizationName || null
    }
  } catch {}

  // Step 5: Save credentials
  saveAuth({
    registry,
    token: accessToken,
    organizationId: orgData.organizationId,
    organizationName: orgData.organizationName
  })

  console.log(`  ${green("✓")} Authenticated${orgData.organizationName ? ` as ${bold(orgData.organizationName)}` : ""}`)
  if (orgData.organizationId) {
    console.log(`  Organization: ${dim(orgData.organizationId)}`)
  }
  console.log(`  Credentials saved to ${dim("~/.promptslide/auth.json")}`)
  console.log()

  closePrompts()
}
