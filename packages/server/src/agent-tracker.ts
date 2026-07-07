/**
 * agent-tracker.ts — server-side capture of AI agent traffic.
 *
 * AI agents (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, …) fetch pages
 * without executing JavaScript, so the browser tracker never sees them. This
 * module runs where the request is actually served — an Express/Connect
 * middleware, a fetch-style handler wrapper, or a manual call — and forwards
 * matched requests to Metrone with the original User-Agent in the
 * `user_agent` payload field. The ingestion worker performs the
 * authoritative classification (visitor_type = 'ai_agent') and the raw UA
 * is never stored.
 *
 * Only requests whose UA matches the AI-agent list are forwarded — normal
 * human traffic is never sent from here (the browser tracker handles it),
 * so this adds zero overhead and zero quota usage for regular visitors.
 *
 * Keep the UA list in sync with AI_AGENT_RULES in
 * packages/worker/src/lib/device-parser.ts (the authoritative matcher).
 */

import type { MetroneServer } from './client.js'

const AI_AGENT_RULES: Array<{ pattern: RegExp; name: string }> = [
  // OpenAI
  { pattern: /chatgpt-user/i,                  name: 'ChatGPT-User' },
  { pattern: /oai-searchbot/i,                 name: 'OAI-SearchBot' },
  { pattern: /gptbot/i,                        name: 'GPTBot' },
  // Anthropic
  { pattern: /claude-user/i,                   name: 'Claude-User' },
  { pattern: /claude-searchbot/i,              name: 'Claude-SearchBot' },
  { pattern: /claudebot/i,                     name: 'ClaudeBot' },
  { pattern: /claude-web/i,                    name: 'Claude-Web' },
  { pattern: /anthropic-ai/i,                  name: 'anthropic-ai' },
  // Perplexity
  { pattern: /perplexity-user/i,               name: 'Perplexity-User' },
  { pattern: /perplexitybot/i,                 name: 'PerplexityBot' },
  // Google AI
  { pattern: /google-cloudvertexbot/i,         name: 'Google-CloudVertexBot' },
  { pattern: /googleother/i,                   name: 'GoogleOther' },
  { pattern: /gemini-deep-research/i,          name: 'Gemini-Deep-Research' },
  // Meta
  { pattern: /meta-externalagent/i,            name: 'Meta-ExternalAgent' },
  { pattern: /meta-externalfetcher/i,          name: 'Meta-ExternalFetcher' },
  // Microsoft Copilot
  { pattern: /bingpreview/i,                   name: 'BingPreview' },
  // xAI
  { pattern: /grokbot/i,                       name: 'GrokBot' },
  { pattern: /xai-crawler/i,                   name: 'xAI-Crawler' },
  // Others
  { pattern: /duckassistbot/i,                 name: 'DuckAssistBot' },
  { pattern: /mistralai-user/i,                name: 'MistralAI-User' },
  { pattern: /cohere-training-data-crawler/i,  name: 'Cohere-Training-Crawler' },
  { pattern: /cohere-ai/i,                     name: 'cohere-ai' },
  { pattern: /bytespider/i,                    name: 'Bytespider' },
  { pattern: /amazonbot/i,                     name: 'Amazonbot' },
  { pattern: /applebot-extended/i,             name: 'Applebot-Extended' },
  { pattern: /ccbot/i,                         name: 'CCBot' },
  { pattern: /youbot/i,                        name: 'YouBot' },
  { pattern: /timpibot/i,                      name: 'TimpiBot' },
  { pattern: /diffbot/i,                       name: 'Diffbot' },
]

/** Static-asset extensions that are noise even when fetched by an agent. */
const STATIC_ASSET_PATTERN = /\.(css|js|mjs|json|xml|txt|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|map|pdf|zip|gz|mp4|webm|mp3)$/i

/**
 * Returns the canonical AI agent name for a User-Agent, or undefined when
 * the UA does not belong to a known AI agent.
 */
export function matchAiAgent(userAgent: string | null | undefined): string | undefined {
  if (!userAgent) return undefined
  for (const rule of AI_AGENT_RULES) {
    if (rule.pattern.test(userAgent)) return rule.name
  }
  return undefined
}

export interface AgentHit {
  /** Full request URL (or at minimum a path). */
  url: string
  /** The visitor's User-Agent header. */
  userAgent: string | null | undefined
  /** Optional Referer header. */
  referrer?: string | null
  /** HTTP method — non-GET/HEAD requests are skipped. Defaults to 'GET'. */
  method?: string
}

export interface AgentTrackerOptions {
  /**
   * Skip requests for static assets (css/js/images/fonts/…). Default: true.
   */
  skipStaticAssets?: boolean
  /**
   * Extra paths to ignore (exact match or prefix ending with '*'),
   * e.g. ['/health', '/api/*'].
   */
  ignorePaths?: string[]
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

function isIgnored(path: string, options?: AgentTrackerOptions): boolean {
  if (options?.skipStaticAssets !== false && STATIC_ASSET_PATTERN.test(path)) return true
  for (const rule of options?.ignorePaths ?? []) {
    if (rule.endsWith('*') ? path.startsWith(rule.slice(0, -1)) : path === rule) return true
  }
  return false
}

/**
 * Core capture: if the request comes from a known AI agent, forward it to
 * Metrone as a pageview with the original UA. Fire-and-forget — never
 * throws, never blocks the response.
 *
 * Returns the matched agent name, or undefined when the request was not an
 * AI agent (or was filtered out).
 *
 * Serverless note: the SDK batches by default; in short-lived environments
 * construct the client with `batchSize: 0` so hits are sent immediately.
 */
export function captureAgentHit(
  metrone: MetroneServer,
  hit: AgentHit,
  options?: AgentTrackerOptions,
): string | undefined {
  try {
    const method = (hit.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') return undefined

    const agent = matchAiAgent(hit.userAgent)
    if (!agent) return undefined

    const path = pathFromUrl(hit.url)
    if (isIgnored(path, options)) return undefined

    metrone.track('pageview', {
      source: 'web',
      page_url: hit.url,
      page_path: path,
      referrer: hit.referrer ?? undefined,
      user_agent: hit.userAgent ?? undefined,
      properties: { agent_capture: 'server' },
    })
    return agent
  } catch {
    // Capture must never break the customer's request handling.
    return undefined
  }
}

/**
 * Express / Connect middleware. Mount early, before routing:
 *
 * ```ts
 * import { MetroneServer, agentMiddleware } from '@metrone-io/server'
 *
 * const metrone = new MetroneServer({ apiKey: process.env.METRONE_API_KEY! })
 * app.use(agentMiddleware(metrone))
 * ```
 */
export function agentMiddleware(metrone: MetroneServer, options?: AgentTrackerOptions) {
  return function metroneAgentMiddleware(
    req: { method?: string; originalUrl?: string; url?: string; headers: Record<string, string | string[] | undefined>; protocol?: string; get?: (name: string) => string | undefined },
    _res: unknown,
    next: (err?: unknown) => void,
  ): void {
    try {
      const header = (name: string): string | undefined => {
        const v = req.headers[name]
        return Array.isArray(v) ? v[0] : v
      }
      const host = header('host') ?? 'localhost'
      const proto = req.protocol ?? (header('x-forwarded-proto') ?? 'https')
      const rawPath = req.originalUrl ?? req.url ?? '/'

      captureAgentHit(metrone, {
        url: `${proto}://${host}${rawPath}`,
        userAgent: header('user-agent'),
        referrer: header('referer') ?? header('referrer'),
        method: req.method,
      }, options)
    } catch {
      // never interfere with the request
    }
    next()
  }
}

/**
 * WHATWG-fetch helper for Hono, Next.js middleware/route handlers, Bun,
 * Deno, and Cloudflare Workers:
 *
 * ```ts
 * trackAgentRequest(metrone, request)
 * ```
 */
export function trackAgentRequest(
  metrone: MetroneServer,
  request: { url: string; method?: string; headers: { get(name: string): string | null } },
  options?: AgentTrackerOptions,
): string | undefined {
  return captureAgentHit(metrone, {
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    referrer: request.headers.get('referer'),
    method: request.method,
  }, options)
}
