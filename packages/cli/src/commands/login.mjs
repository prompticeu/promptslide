import { execFileSync } from "node:child_process"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { saveAuth, DEFAULT_REGISTRY } from "../utils/auth.mjs"
import { prompt, closePrompts } from "../utils/prompts.mjs"
import { fetchOrganizations } from "../utils/registry.mjs"

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function openBrowser(url) {
  try {
    const platform = process.platform
    if (platform === "darwin") {
      execFileSync("open", [url], { stdio: "ignore" })
    } else if (platform === "win32") {
      execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore" })
    } else {
      execFileSync("xdg-open", [url], { stdio: "ignore" })
    }
  } catch {}
}

export function accessTokenFromResponse(data) {
  const payload = data?.data ?? data
  const token = payload?.access_token || payload?.accessToken || payload?.token
  if (typeof token !== "string" || !token.trim())
    throw new Error("Registry authorization returned no access token. Login was not saved.")
  return token
}

export function deviceRetryDelay(retryAfter, currentInterval, now = Date.now()) {
  let requested = NaN
  if (retryAfter !== null && retryAfter.trim()) {
    requested = /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter) - now
  }
  return Number.isFinite(requested) && requested >= 0
    ? Math.max(currentInterval, requested)
    : Math.max(60000, currentInterval * 2)
}

export function findLoginOrganization(organizations, selector) {
  const organization = organizations.find(org =>
    [org.id, org.slug, org.name].some(value => value === selector)
  )
  if (!organization) throw new Error(`Organization not found: ${selector}`)
  return organization
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
  const orgIdx = args.indexOf("--org")
  const requestedOrganization = orgIdx === -1 ? null : args[orgIdx + 1]
  if (orgIdx !== -1 && (!requestedOrganization || requestedOrganization.startsWith("--"))) {
    console.error(`  ${red("Error:")} --org requires an organization slug or ID.`)
    process.exit(1)
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

  const {
    device_code,
    user_code,
    verification_uri_complete,
    verification_uri,
    interval: initialInterval,
    expires_in
  } = deviceData
  let pollInterval = (initialInterval || 5) * 1000
  const timeoutMs = (expires_in || 600) * 1000 // Default 10 min

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
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(Math.min(pollInterval, deadline - Date.now()))
    if (Date.now() >= deadline) break

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

      if (res.status === 429) {
        pollInterval = deviceRetryDelay(res.headers.get("retry-after"), pollInterval)
        console.log(
          `  ${dim(`Registry rate limit; retrying in ${Math.ceil(pollInterval / 1000)} seconds.`)}`
        )
        continue
      }

      const data = await res.json()

      if (data.error === "authorization_pending") continue
      if (data.error === "slow_down") {
        pollInterval += 5000
        continue
      }
      if (data.error) {
        throw new Error(data.error_description || data.error)
      }

      if (!res.ok) throw new Error(`Registry token request failed (${res.status}).`)
      accessTokenFromResponse(data)

      tokenData = data
      break
    } catch (err) {
      if (err.message === "authorization_pending") continue
      console.error(`\n  ${red("Error:")} ${err.message}`)
      process.exit(1)
    }
  }

  if (!tokenData) {
    console.error(`\n  ${red("Error:")} Authorization timed out. Please try again.`)
    process.exit(1)
  }

  const accessToken = accessTokenFromResponse(tokenData)
  // Device tokens are consumed once. Persist before any optional interactive
  // organization selection so EOF or Ctrl+C cannot discard a valid session.
  saveAuth({ registry, token: accessToken })
  console.log(`  ${green("✓")} Authenticated`)

  // Step 4: Fetch user's organizations and let them pick
  let organizationId = null
  let organizationName = null
  let organizationSlug = null

  try {
    const orgs = await fetchOrganizations({ registry, token: accessToken })

    if (requestedOrganization) {
      const selected = findLoginOrganization(orgs, requestedOrganization)
      organizationId = selected.id
      organizationName = selected.name
      organizationSlug = selected.slug
    } else if (orgs.length === 0) {
      console.log(`  ${dim("No organizations found. Create one at your dashboard.")}`)
    } else if (orgs.length === 1) {
      organizationId = orgs[0].id
      organizationName = orgs[0].name
      organizationSlug = orgs[0].slug
    } else if (!process.stdin.isTTY) {
      console.log(
        `  ${dim("Multiple organizations available. Use login --org <slug> or promptslide org to select one.")}`
      )
    } else {
      console.log()
      console.log(`  ${bold("Select organization:")}`)
      orgs.forEach((org, i) => {
        console.log(`    ${dim(`${i + 1}.`)} ${org.name} ${dim(`(${org.slug})`)}`)
      })
      console.log()

      const choice = await prompt("Organization number:", "1")
      const idx = parseInt(choice, 10) - 1
      if (idx >= 0 && idx < orgs.length) {
        organizationId = orgs[idx].id
        organizationName = orgs[idx].name
        organizationSlug = orgs[idx].slug
      } else {
        console.error(`  ${red("Error:")} Invalid selection. Using first organization.`)
        organizationId = orgs[0].id
        organizationName = orgs[0].name
        organizationSlug = orgs[0].slug
      }
    }
  } catch (err) {
    if (requestedOrganization) {
      console.error(`  ${red("Error:")} Could not select organization: ${err.message}`)
      console.error(
        `  ${dim("Your token is saved. Run promptslide org to select an organization.")}`
      )
      closePrompts()
      process.exitCode = 1
      return
    }
    console.log(`  ${dim("Could not fetch organizations: " + err.message)}`)
  }

  // Step 5: Save credentials
  saveAuth({
    registry,
    token: accessToken,
    organizationId,
    organizationName,
    organizationSlug
  })

  if (organizationName) {
    console.log(`  Organization: ${bold(organizationName)}`)
  }
  console.log(`  Credentials saved to ${dim("~/.promptslide/auth.json")}`)
  console.log()

  closePrompts()
}
