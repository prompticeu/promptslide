/**
 * PromptSlide MCP Server.
 *
 * Lightweight MCP server that manages slide decks on disk.
 * Spawns a Vite dev server as a child process when preview/screenshots are needed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { registerReadTools } from "./tools/read.mjs"
import { registerWriteTools } from "./tools/write.mjs"
import { registerDeleteTools } from "./tools/delete.mjs"
import { registerAssetTools } from "./tools/assets.mjs"
import { registerThemeTools } from "./tools/themes.mjs"
import { registerAnnotationTools } from "./tools/annotations.mjs"
import { registerUtilityTools } from "./tools/utility.mjs"

/**
 * Start the MCP server.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Path to the deck directory
 */
export async function startMcpServer({ deckRoot }) {
  const server = new McpServer({
    name: "promptslide",
    version: "1.0.0",
    description: `PromptSlide — Create slide deck presentations.
Slides are HTML files with Tailwind CSS. The framework handles
animations, transitions, theming, and presentation mode.

Use get_deck_info to see current state.
Use get_guide("getting-started") for framework details.
Use get_guide("design") for slide design best practices.`
  })

  const context = { deckRoot }

  // Register all tool groups
  registerReadTools(server, context)
  registerWriteTools(server, context)
  registerDeleteTools(server, context)
  registerAssetTools(server, context)
  registerThemeTools(server, context)
  registerAnnotationTools(server, context)
  registerUtilityTools(server, context)

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
