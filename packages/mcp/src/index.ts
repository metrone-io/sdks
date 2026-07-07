/**
 * index.ts — Metrone MCP server, stdio transport (@metrone-io/mcp binary)
 *
 * v1.1 SPEC-06A: tool definitions moved to ./tools.ts so the worker's
 * /mcp HTTP transport shares the same registry. This entry point is now a
 * thin stdio adapter: it wires an HTTP executor (fetch against
 * METRONE_ENDPOINT with the env API key) into the shared dispatch().
 *
 * Externally identical to v1.0.1: same env contract (METRONE_API_KEY
 * required, METRONE_ENDPOINT optional), same 7 tools, same response shape
 * (pretty-printed JSON text content), same 30s request timeout, same
 * early-exit when the key is missing.
 *
 * Implementation note: uses the SDK's low-level Server (setRequestHandler)
 * instead of McpServer.tool() because the shared registry carries plain
 * JSON Schema rather than zod shapes — the wire protocol wants JSON Schema
 * anyway, and keeping zod out of tools.ts keeps the worker bundle clean.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { dispatch, listTools, type ToolApiRequest, type ToolExecutor } from './tools.js'

const API_KEY = process.env.METRONE_API_KEY
const ENDPOINT = process.env.METRONE_ENDPOINT ?? 'https://api.metrone.io'

if (!API_KEY) {
  console.error('METRONE_API_KEY environment variable is required')
  process.exit(1)
}

const REQUEST_TIMEOUT_MS = 30_000

/**
 * HTTP executor for the stdio transport. Mirrors the v1.0.1 apiGet/apiPost
 * behavior: X-Api-Key header auth, 30s abort, api_key injected into POST
 * bodies (the authenticated write endpoint ignores it in favour of the
 * header key, but the field is kept for exact backward compatibility),
 * empty-string query params skipped.
 */
const httpExecutor: ToolExecutor = async (req: ToolApiRequest) => {
  const url = new URL(req.path, ENDPOINT)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let res: Response
    if (req.method === 'GET') {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v)
      }
      res = await fetch(url.toString(), {
        headers: { 'X-Api-Key': API_KEY! },
        signal: controller.signal,
      })
    } else {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'X-Api-Key': API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: API_KEY, ...req.body }),
        signal: controller.signal,
      })
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Metrone API error ${res.status}: ${body}`)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

const server = new Server(
  { name: 'metrone', version: '1.0.1' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: listTools(),
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  try {
    const data = await dispatch(name, (args ?? {}) as Record<string, unknown>, httpExecutor)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    }
  } catch (err) {
    // Tool failures surface as isError results (not protocol errors) so the
    // calling agent can read the message — same behavior McpServer.tool()
    // provided in v1.0.1.
    return {
      content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
