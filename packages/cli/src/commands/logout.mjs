import { bold, green, dim } from "../utils/ansi.mjs"
import { clearAuth } from "../utils/auth.mjs"

export async function logout() {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("logout")}`)
  console.log()

  const removed = clearAuth()

  if (removed) {
    console.log(`  ${green("✓")} Logged out. Credentials removed.`)
  } else {
    console.log(`  ${dim("Not logged in.")}`)
  }
  console.log()
}
