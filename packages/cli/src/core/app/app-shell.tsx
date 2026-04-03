import { useState } from "react"
import {
  Home, Presentation, Settings, Globe, LogOut, Loader2,
  ExternalLink, Copy, Check, ChevronDown, Building2
} from "lucide-react"

import { cn } from "../utils"
import { Button } from "./ui/button"
import { useAuth } from "./hooks/use-auth"
import type { Organization } from "./hooks/use-auth"

interface AppShellProps {
  children: React.ReactNode
  currentPath?: string
}

const navItems = [
  { label: "Library", href: "/", icon: <Home className="size-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="size-4" /> },
]

export function AppShell({ children, currentPath = "/" }: AppShellProps) {
  const { auth, organizations, orgsLoading, loginState, startLogin, logout, switchOrg } = useAuth()
  const [copied, setCopied] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <aside className="glass-sidebar flex w-56 shrink-0 flex-col bg-neutral-950/90">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-neutral-800/50 px-4 py-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[oklch(0.661_0.201_41.38)]">
            <Presentation className="size-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">PromptSlide</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-2 py-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                currentPath === item.href
                  ? "bg-[oklch(0.661_0.201_41.38/0.12)] text-[oklch(0.661_0.201_41.38)]"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Registry Connection + Org Switcher */}
        <div className="border-t border-neutral-800/50 px-3 py-3">
          {auth.loading ? (
            <div className="flex items-center gap-2 px-1 text-xs text-neutral-500">
              <Loader2 className="size-3 animate-spin" />
              Checking...
            </div>
          ) : auth.authenticated ? (
            <div className="flex flex-col gap-2">
              {/* Org Switcher */}
              <div className="relative">
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-800/50"
                >
                  <Building2 className="size-3 shrink-0 text-emerald-500" />
                  <span className="flex-1 truncate text-xs text-neutral-200">
                    {auth.organizationName || "Select org"}
                  </span>
                  <ChevronDown className={cn(
                    "size-3 text-neutral-500 transition-transform",
                    orgDropdownOpen && "rotate-180"
                  )} />
                </button>

                {/* Dropdown */}
                {orgDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOrgDropdownOpen(false)} />
                    <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
                      {orgsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
                          <Loader2 className="size-3 animate-spin" />
                          Loading...
                        </div>
                      ) : organizations.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-neutral-500">No organizations</div>
                      ) : (
                        organizations.map((org) => (
                          <button
                            key={org.id}
                            onClick={() => {
                              switchOrg(org)
                              setOrgDropdownOpen(false)
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                              org.id === auth.organizationId
                                ? "bg-[oklch(0.661_0.201_41.38/0.1)] text-[oklch(0.661_0.201_41.38)]"
                                : "text-neutral-300 hover:bg-neutral-800"
                            )}
                          >
                            <Building2 className="size-3 shrink-0" />
                            <span className="flex-1 truncate">{org.name}</span>
                            {org.role && (
                              <span className="text-[10px] text-neutral-600">{org.role}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-800/50 hover:text-neutral-300"
              >
                <LogOut className="size-3" />
                Disconnect
              </button>
            </div>
          ) : loginState.active ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] text-neutral-400">Enter this code in your browser:</p>
              {loginState.userCode && (
                <button
                  onClick={() => copyCode(loginState.userCode!)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 font-mono text-sm font-bold text-white transition-colors hover:border-neutral-600"
                >
                  {loginState.userCode}
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-neutral-500" />}
                </button>
              )}
              {loginState.verificationUrl && (
                <a
                  href={loginState.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-1 text-[11px] text-[oklch(0.661_0.201_41.38)] hover:underline"
                >
                  Open in browser <ExternalLink className="size-3" />
                </a>
              )}
              <div className="flex items-center gap-2 px-1 text-[11px] text-neutral-500">
                <Loader2 className="size-3 animate-spin" /> Waiting for authorization...
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={startLogin} className="w-full justify-start gap-2">
                <Globe className="size-3.5" /> Connect to Registry
              </Button>
              {loginState.error && <p className="px-1 text-[11px] text-red-400">{loginState.error}</p>}
            </div>
          )}
        </div>

        {/* MCP Status */}
        <div className="border-t border-neutral-800/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <div className="size-1.5 rounded-full bg-emerald-500" />
            MCP Server Active
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
