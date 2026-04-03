import { Globe, HardDrive, Radio, Info } from "lucide-react"

import { AppShell } from "../app-shell"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { useAuth } from "../hooks/use-auth"

export function SettingsView() {
  const { auth } = useAuth()

  return (
    <AppShell currentPath="/settings">
      <div className="px-8 py-8">
        <div className="mb-8 animate-fade-up">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Configuration
          </h1>
        </div>

        <div className="flex max-w-2xl flex-col gap-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {/* Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="size-4 text-neutral-400" />
                Deck Storage
              </CardTitle>
              <CardDescription>Where your decks are stored locally</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="rounded-md bg-neutral-800/50 px-2 py-1 font-mono text-xs text-neutral-300">
                ~/.promptslide/decks/
              </code>
            </CardContent>
          </Card>

          {/* Registry */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-4 text-neutral-400" />
                Registry
              </CardTitle>
              <CardDescription>Connection to PromptSlide Registry</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {auth.authenticated ? (
                  <>
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-neutral-200">
                      Connected to {auth.organizationName || auth.registry}
                    </span>
                    <Badge variant="outline">{auth.organizationSlug}</Badge>
                  </>
                ) : (
                  <>
                    <div className="size-2 rounded-full bg-neutral-600" />
                    <span className="text-sm text-neutral-400">Not connected</span>
                    <span className="text-xs text-neutral-600">Use sidebar to connect</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* MCP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-4 text-neutral-400" />
                MCP Server
              </CardTitle>
              <CardDescription>Model Context Protocol server for AI integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-neutral-200">Active</span>
                <Badge variant="ghost">HTTP transport</Badge>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4 text-neutral-400" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 text-xs text-neutral-500">
                <span>PromptSlide Desktop App</span>
                <span>Powered by Tauri + Vite + React</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
