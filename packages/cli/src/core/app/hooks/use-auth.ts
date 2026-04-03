import { useState, useEffect, useCallback } from "react"

export interface AuthState {
  authenticated: boolean
  registry: string | null
  organizationId: string | null
  organizationName: string | null
  organizationSlug: string | null
  loading: boolean
}

export interface Organization {
  id: string
  name: string
  slug: string
  role?: string
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  interval: number
  expires_in: number
}

const INITIAL_STATE: AuthState = {
  authenticated: false,
  registry: null,
  organizationId: null,
  organizationName: null,
  organizationSlug: null,
  loading: true,
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(INITIAL_STATE)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [loginState, setLoginState] = useState<{
    active: boolean
    userCode: string | null
    verificationUrl: string | null
    error: string | null
  }>({ active: false, userCode: null, verificationUrl: null, error: null })

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    try {
      const res = await fetch("/__promptslide_api/auth/status")
      if (!res.ok) throw new Error("Failed to check auth")
      const data = await res.json()
      const newAuth = {
        authenticated: data.authenticated,
        registry: data.registry,
        organizationId: data.organizationId || null,
        organizationName: data.organizationName,
        organizationSlug: data.organizationSlug,
        loading: false,
      }
      setAuth(newAuth)
      if (data.authenticated) fetchOrganizations()
    } catch {
      setAuth({ ...INITIAL_STATE, loading: false })
    }
  }

  async function fetchOrganizations() {
    setOrgsLoading(true)
    try {
      const res = await fetch("/__promptslide_api/auth/organizations")
      if (!res.ok) return
      const data = await res.json()
      setOrganizations(data.organizations || [])
    } catch {} finally {
      setOrgsLoading(false)
    }
  }

  const switchOrg = useCallback(async (org: Organization) => {
    try {
      const res = await fetch("/__promptslide_api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
        }),
      })
      if (!res.ok) throw new Error("Failed to switch org")
      setAuth((prev) => ({
        ...prev,
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
      }))
    } catch {}
  }, [])

  const startLogin = useCallback(async () => {
    setLoginState({ active: true, userCode: null, verificationUrl: null, error: null })
    try {
      const codeRes = await fetch("/__promptslide_api/auth/login", { method: "POST" })
      if (!codeRes.ok) throw new Error("Failed to start login")
      const codeData: DeviceCodeResponse = await codeRes.json()

      const verifyUrl = codeData.verification_uri_complete || codeData.verification_uri
      setLoginState({ active: true, userCode: codeData.user_code, verificationUrl: verifyUrl, error: null })
      window.open(verifyUrl, "_blank")

      const pollInterval = (codeData.interval || 5) * 1000
      const deadline = Date.now() + (codeData.expires_in || 600) * 1000

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollInterval))
        const pollRes = await fetch("/__promptslide_api/auth/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: codeData.device_code }),
        })
        if (!pollRes.ok) continue
        const pollData = await pollRes.json()
        if (pollData.status === "pending") continue
        if (pollData.status === "error") {
          setLoginState((s) => ({ ...s, error: pollData.message, active: false }))
          return
        }
        if (pollData.status === "authenticated") {
          setLoginState({ active: false, userCode: null, verificationUrl: null, error: null })
          await checkAuth()
          return
        }
      }
      setLoginState((s) => ({ ...s, error: "Login timed out", active: false }))
    } catch (err) {
      setLoginState({
        active: false, userCode: null, verificationUrl: null,
        error: err instanceof Error ? err.message : "Login failed",
      })
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch("/__promptslide_api/auth/logout", { method: "POST" })
    setAuth({ ...INITIAL_STATE, loading: false })
    setOrganizations([])
  }, [])

  return { auth, organizations, orgsLoading, loginState, startLogin, logout, switchOrg }
}
