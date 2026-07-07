/**
 * tools.ts — shared MCP tool registry (v1.1 SPEC-06A)
 *
 * Single source of truth for Metrone's MCP tools, consumed by BOTH transports:
 *
 *   - stdio  (src/index.ts, the published @metrone-io/mcp binary): injects an
 *     HTTP executor that fetches METRONE_ENDPOINT with the env API key.
 *   - HTTP   (packages/worker /mcp route): injects an INTERNAL executor that
 *     synthesizes Requests against the worker's own handlers — no self-fetch
 *     (Cloudflare blocks same-zone worker self-fetch) and no extra network hop.
 *
 * Adding a tool here makes it available on both transports automatically
 * (this is the contract SPEC-06B relies on when it adds 8 more tools).
 *
 * Design constraints:
 *   - This module is dependency-free (no zod, no MCP SDK) so the worker can
 *     bundle it without dragging Node-targeted dependencies into the
 *     Cloudflare runtime. Input schemas are plain JSON Schema — which is
 *     what the MCP wire protocol (tools/list) wants anyway.
 *   - Validation here is intentionally light (required fields + basic types).
 *     The REST API performs the authoritative validation; duplicating it
 *     would drift.
 */

// ─── Executor contract ────────────────────────────────────────────────────────

/** A request a tool wants to make against the Metrone REST API. */
export type ToolApiRequest =
  | { method: 'GET'; path: string; query: Record<string, string> }
  | { method: 'POST'; path: string; body: Record<string, unknown> }

/**
 * Transport-specific executor. Receives the API request spec, performs it
 * (HTTP fetch for stdio, internal handler dispatch for the worker), and
 * returns the parsed JSON response body. MUST throw on non-2xx responses —
 * dispatch() converts throws into MCP isError tool results.
 */
export type ToolExecutor = (req: ToolApiRequest) => Promise<unknown>

// ─── Tool descriptors ─────────────────────────────────────────────────────────

export type ToolScope = 'read' | 'write'

export interface ToolDescriptor {
  name: string
  description: string
  /** Plain JSON Schema (draft-07 subset) for the MCP tools/list response. */
  inputSchema: Record<string, unknown>
  /** Minimum API-key scope this tool needs. */
  scope: ToolScope
  /** Translate validated args into an API request spec. */
  buildRequest: (args: Record<string, unknown>) => ToolApiRequest
}

function num(v: unknown): string | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function query(entries: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export const TOOLS: ToolDescriptor[] = [
  {
    name: 'metrone_get_stats',
    description: 'Get aggregated analytics statistics (events, pageviews, visitors, sessions, conversion rate) for a time period.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-back window in days (default 30)' },
        from: { type: 'string', description: 'ISO 8601 start date (overrides days)' },
        to: { type: 'string', description: 'ISO 8601 end date' },
      },
    },
    buildRequest: args => ({
      method: 'GET',
      path: '/v1/api/stats',
      query: query({ days: num(args.days), from: str(args.from), to: str(args.to) }),
    }),
  },
  {
    name: 'metrone_get_events',
    description: 'Query raw analytics events with optional filters for event type and source.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number' },
        limit: { type: 'number' },
        event_type: { type: 'string' },
        source: { type: 'string' },
      },
    },
    buildRequest: args => ({
      method: 'GET',
      path: '/v1/api/events',
      query: query({
        days: num(args.days),
        limit: num(args.limit),
        event_type: str(args.event_type),
        source: str(args.source),
      }),
    }),
  },
  {
    name: 'metrone_get_pages',
    description: 'Get top pages by views and sessions.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number' },
        limit: { type: 'number' },
      },
    },
    buildRequest: args => ({
      method: 'GET',
      path: '/v1/api/pages',
      query: query({ days: num(args.days), limit: num(args.limit) }),
    }),
  },
  {
    name: 'metrone_get_sources',
    description: 'Get traffic source and referrer breakdown.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number' },
      },
    },
    buildRequest: args => ({
      method: 'GET',
      path: '/v1/api/sources',
      query: query({ days: num(args.days) }),
    }),
  },
  {
    name: 'metrone_get_live',
    description: 'Get real-time stats: active visitors and today\u2019s totals.',
    scope: 'read',
    inputSchema: { type: 'object', properties: {} },
    buildRequest: () => ({ method: 'GET', path: '/v1/api/live', query: {} }),
  },
  {
    name: 'metrone_track_event',
    description: 'Track a custom analytics event.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: { type: 'string' },
        source: { type: 'string', description: 'Event source (defaults to "assistant")' },
        event_name: { type: 'string' },
        page_url: { type: 'string' },
        properties: { type: 'object' },
      },
      required: ['event_type'],
    },
    buildRequest: args => {
      const body: Record<string, unknown> = {
        event_type: args.event_type,
        source: str(args.source) ?? 'assistant',
      }
      if (str(args.event_name)) body.event_name = args.event_name
      if (str(args.page_url)) body.page_url = args.page_url
      if (args.properties && typeof args.properties === 'object') body.properties = args.properties
      return { method: 'POST', path: '/v1/api/events', body }
    },
  },
  {
    name: 'metrone_track_ai_call',
    description: 'Track an AI call event (voice / chat / assistant interaction).',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        call_id: { type: 'string' },
        provider: { type: 'string' },
        source: { type: 'string', enum: ['voice', 'chat', 'assistant'] },
        duration: { type: 'number', description: 'Duration in seconds' },
        intent: { type: 'string' },
        outcome: { type: 'string' },
        properties: { type: 'object' },
      },
      required: ['call_id', 'provider'],
    },
    buildRequest: args => {
      const body: Record<string, unknown> = {
        event_type: 'ai_call',
        source: str(args.source) ?? 'voice',
        ai_call_id: args.call_id,
        ai_provider: args.provider,
      }
      if (typeof args.duration === 'number') body.ai_duration_sec = args.duration
      if (str(args.intent)) body.ai_intent = args.intent
      const props = (args.properties && typeof args.properties === 'object') ? args.properties as Record<string, unknown> : undefined
      if (props || str(args.outcome)) {
        body.properties = { ...props, ...(str(args.outcome) ? { outcome: args.outcome } : {}) }
      }
      return { method: 'POST', path: '/v1/api/events', body }
    },
  },
]

const TOOLS_BY_NAME = new Map(TOOLS.map(t => [t.name, t]))

// ─── Public API ───────────────────────────────────────────────────────────────

/** Tool list in MCP tools/list wire format. */
export function listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}

export function getTool(name: string): ToolDescriptor | undefined {
  return TOOLS_BY_NAME.get(name)
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolValidationError'
  }
}

/**
 * Validate args against the tool's required fields. Light by design — the
 * REST API is the authoritative validator. Throws ToolValidationError so
 * transports can map it to the right error shape (-32602 for JSON-RPC,
 * isError result for tool calls).
 */
export function validateArgs(tool: ToolDescriptor, args: Record<string, unknown>): void {
  const required = (tool.inputSchema.required as string[] | undefined) ?? []
  for (const field of required) {
    const v = args[field]
    if (v === undefined || v === null || (typeof v === 'string' && v.length === 0)) {
      throw new ToolValidationError(`Missing required argument: ${field}`)
    }
  }
}

/**
 * Execute a tool by name through the injected executor. Returns the parsed
 * API response. Throws:
 *   - ToolValidationError for unknown tool / missing required args
 *   - whatever the executor throws for API failures
 */
export async function dispatch(
  toolName: string,
  args: Record<string, unknown>,
  executor: ToolExecutor,
): Promise<unknown> {
  const tool = getTool(toolName)
  if (!tool) {
    throw new ToolValidationError(`Unknown tool: ${toolName}`)
  }
  validateArgs(tool, args)
  return executor(tool.buildRequest(args))
}
