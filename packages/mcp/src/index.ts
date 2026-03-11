import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_KEY = process.env.METRONE_API_KEY
const ENDPOINT = process.env.METRONE_ENDPOINT ?? 'https://api.metrone.io'

if (!API_KEY) {
  console.error('METRONE_API_KEY environment variable is required')
  process.exit(1)
}

async function apiGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(path, ENDPOINT)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': API_KEY! },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Metrone API error ${res.status}: ${body}`)
  }
  return res.json()
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const url = new URL(path, ENDPOINT)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metrone API error ${res.status}: ${text}`)
  }
  return res.json()
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

const server = new McpServer({ name: 'metrone', version: '1.0.0' })

server.tool(
  'metrone_get_stats',
  {
    days: z.number().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  },
  async ({ days, from, to }) => {
    const params: Record<string, string> = {}
    if (days !== undefined) params.days = String(days)
    if (from) params.from = from
    if (to) params.to = to
    return textResult(await apiGet('/v1/api/stats', params))
  },
)

server.tool(
  'metrone_get_events',
  {
    days: z.number().optional(),
    limit: z.number().optional(),
    event_type: z.string().optional(),
    source: z.string().optional(),
  },
  async ({ days, limit, event_type, source }) => {
    const params: Record<string, string> = {}
    if (days !== undefined) params.days = String(days)
    if (limit !== undefined) params.limit = String(limit)
    if (event_type) params.event_type = event_type
    if (source) params.source = source
    return textResult(await apiGet('/v1/api/events', params))
  },
)

server.tool(
  'metrone_get_pages',
  {
    days: z.number().optional(),
    limit: z.number().optional(),
  },
  async ({ days, limit }) => {
    const params: Record<string, string> = {}
    if (days !== undefined) params.days = String(days)
    if (limit !== undefined) params.limit = String(limit)
    return textResult(await apiGet('/v1/api/pages', params))
  },
)

server.tool(
  'metrone_get_sources',
  { days: z.number().optional() },
  async ({ days }) => {
    const params: Record<string, string> = {}
    if (days !== undefined) params.days = String(days)
    return textResult(await apiGet('/v1/api/sources', params))
  },
)

server.tool(
  'metrone_get_live',
  {},
  async (_args) => textResult(await apiGet('/v1/api/live')),
)

server.tool(
  'metrone_track_event',
  {
    event_type: z.string(),
    source: z.string().optional(),
    event_name: z.string().optional(),
    page_url: z.string().optional(),
    properties: z.record(z.string(), z.any()).optional(),
  },
  async ({ event_type, source, event_name, page_url, properties }) => {
    const payload: Record<string, unknown> = {
      api_key: API_KEY,
      event_type,
      source: source ?? 'assistant',
    }
    if (event_name) payload.event_name = event_name
    if (page_url) payload.page_url = page_url
    if (properties) payload.properties = properties
    return textResult(await apiPost('/v1/api/events', payload))
  },
)

server.tool(
  'metrone_track_ai_call',
  {
    call_id: z.string(),
    provider: z.string(),
    duration: z.number().optional(),
    intent: z.string().optional(),
    outcome: z.string().optional(),
    properties: z.record(z.string(), z.any()).optional(),
  },
  async ({ call_id, provider, duration, intent, outcome, properties }) => {
    const payload: Record<string, unknown> = {
      api_key: API_KEY,
      event_type: 'ai_call',
      source: 'voice',
      ai_call_id: call_id,
      ai_provider: provider,
    }
    if (duration !== undefined) payload.ai_duration_sec = duration
    if (intent) payload.ai_intent = intent
    if (properties || outcome) {
      payload.properties = { ...properties, ...(outcome && { outcome }) }
    }
    return textResult(await apiPost('/v1/api/events', payload))
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
