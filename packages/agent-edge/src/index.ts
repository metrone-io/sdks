/**
 * Metrone AI Agent Edge Tracker.
 *
 * Runs on the customer's Cloudflare zone. Every request passes through to
 * the origin untouched; when the User-Agent belongs to a known AI agent
 * (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, …) a tracking event is
 * sent to Metrone inside ctx.waitUntil — after the response has already
 * been returned, so agent capture can never slow the site down.
 *
 * Only AI-agent requests are forwarded. Human traffic is handled by the
 * browser tracker (m.js) and never touches this path, so the Worker adds
 * zero quota usage and zero latency for regular visitors.
 *
 * The Metrone ingestion worker performs the authoritative classification
 * from the forwarded `user_agent` field (stored as visitor_type='ai_agent';
 * the raw UA itself is parsed and discarded, never stored).
 *
 * Keep the UA list in sync with AI_AGENT_RULES in
 * packages/worker/src/lib/device-parser.ts.
 */

export interface Env {
  /** Metrone project API key (metrone_live_… / mk_live_…). Set as a secret. */
  METRONE_API_KEY?: string
  /** Ingestion endpoint. Defaults to https://api.metrone.io */
  METRONE_ENDPOINT?: string
}

const AI_AGENT_PATTERN = new RegExp(
  [
    // OpenAI
    'chatgpt-user', 'oai-searchbot', 'gptbot',
    // Anthropic
    'claude-user', 'claude-searchbot', 'claudebot', 'claude-web', 'anthropic-ai',
    // Perplexity
    'perplexity-user', 'perplexitybot',
    // Google AI
    'google-cloudvertexbot', 'googleother', 'gemini-deep-research',
    // Meta
    'meta-externalagent', 'meta-externalfetcher',
    // Microsoft Copilot
    'bingpreview',
    // xAI
    'grokbot', 'xai-crawler',
    // Others
    'duckassistbot', 'mistralai-user', 'cohere-training-data-crawler',
    'cohere-ai', 'bytespider', 'amazonbot', 'applebot-extended', 'ccbot',
    'youbot', 'timpibot', 'diffbot',
  ].join('|'),
  'i',
)

/** Static assets are noise even when fetched by an agent. */
const STATIC_ASSET_PATTERN = /\.(css|js|mjs|json|xml|txt|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|map|pdf|zip|gz|mp4|webm|mp3)$/i

export function isAiAgent(userAgent: string | null): boolean {
  return userAgent !== null && AI_AGENT_PATTERN.test(userAgent)
}

export function shouldCapture(request: Request, response: Response): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (!isAiAgent(request.headers.get('User-Agent'))) return false

  const path = new URL(request.url).pathname
  if (STATIC_ASSET_PATTERN.test(path)) return false

  // Only successful HTML pages — the content an AI model actually reads.
  if (!response.ok) return false
  const contentType = response.headers.get('Content-Type') ?? ''
  return contentType.includes('text/html')
}

export function buildEventPayload(request: Request, apiKey: string): Record<string, unknown> {
  const url = new URL(request.url)
  return {
    api_key: apiKey,
    event_type: 'pageview',
    source: 'web',
    page_url: request.url,
    page_path: url.pathname,
    referrer: request.headers.get('Referer') ?? undefined,
    user_agent: request.headers.get('User-Agent') ?? undefined,
    timestamp: new Date().toISOString(),
    properties: { agent_capture: 'edge' },
  }
}

async function sendToMetrone(request: Request, env: Env): Promise<void> {
  try {
    const endpoint = (env.METRONE_ENDPOINT ?? 'https://api.metrone.io').replace(/\/+$/, '')
    await fetch(`${endpoint}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventPayload(request, env.METRONE_API_KEY as string)),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    // Fail-open: agent tracking must never surface errors to the site.
    console.warn('[metrone-agent-tracker] send failed:', (err as Error).message)
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Pass through to the origin first — the visitor (agent or human) always
    // gets the normal response, whatever happens below.
    const response = await fetch(request)

    try {
      if (env.METRONE_API_KEY && shouldCapture(request, response)) {
        ctx.waitUntil(sendToMetrone(request, env))
      }
    } catch (err) {
      console.warn('[metrone-agent-tracker] capture error:', (err as Error).message)
    }

    return response
  },
}
