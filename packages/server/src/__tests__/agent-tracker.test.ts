/**
 * agent-tracker.test.ts — server-side AI agent capture.
 *
 * Key invariants:
 *   - only known AI agent UAs produce a tracked event; humans never do
 *   - the event carries the original UA in `user_agent` and agent_capture
 *   - the Express middleware always calls next(), even on internal errors
 *   - static assets and ignored paths are skipped
 */

import { describe, it, expect, vi } from 'vitest'
import { MetroneServer } from '../client.js'
import { matchAiAgent, captureAgentHit, agentMiddleware, trackAgentRequest } from '../agent-tracker.js'

const VALID_KEY = 'metrone_live_' + 'a'.repeat(32)
const GPTBOT_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'
const PERPLEXITY_UA = 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function createClient() {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  // batchSize 0 → every track() sends immediately, so assertions can
  // inspect the fetch mock without flushing.
  const client = new MetroneServer({ apiKey: VALID_KEY, batchSize: 0, flushIntervalMs: 0, maxRetries: 0, fetch })
  return { client, fetch }
}

async function sentPayload(fetch: ReturnType<typeof vi.fn>): Promise<Record<string, unknown>> {
  expect(fetch).toHaveBeenCalledTimes(1)
  const [, init] = fetch.mock.calls[0] as [string, { body: string }]
  return JSON.parse(init.body)
}

describe('matchAiAgent', () => {
  it('matches AI agents and rejects humans/search bots', () => {
    expect(matchAiAgent(GPTBOT_UA)).toBe('GPTBot')
    expect(matchAiAgent(PERPLEXITY_UA)).toBe('PerplexityBot')
    expect(matchAiAgent(CHROME_UA)).toBeUndefined()
    expect(matchAiAgent(GOOGLEBOT_UA)).toBeUndefined()
    expect(matchAiAgent(null)).toBeUndefined()
  })
})

describe('captureAgentHit', () => {
  it('tracks a pageview with the original UA for AI agents', async () => {
    const { client, fetch } = createClient()
    const agent = captureAgentHit(client, {
      url: 'https://example.com/pricing?ref=1',
      userAgent: GPTBOT_UA,
      referrer: 'https://chat.openai.com/',
    })

    expect(agent).toBe('GPTBot')
    const payload = await sentPayload(fetch)
    expect(payload.event_type).toBe('pageview')
    expect(payload.page_url).toBe('https://example.com/pricing?ref=1')
    expect(payload.page_path).toBe('/pricing')
    expect(payload.user_agent).toBe(GPTBOT_UA)
    expect(payload.properties).toEqual({ agent_capture: 'server' })
  })

  it('never tracks human traffic', () => {
    const { client, fetch } = createClient()
    const agent = captureAgentHit(client, { url: 'https://example.com/', userAgent: CHROME_UA })
    expect(agent).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips static assets, non-GET methods, and ignored paths', () => {
    const { client, fetch } = createClient()
    expect(captureAgentHit(client, { url: 'https://example.com/app.css', userAgent: GPTBOT_UA })).toBeUndefined()
    expect(captureAgentHit(client, { url: 'https://example.com/x', userAgent: GPTBOT_UA, method: 'POST' })).toBeUndefined()
    expect(captureAgentHit(client, { url: 'https://example.com/health', userAgent: GPTBOT_UA }, { ignorePaths: ['/health'] })).toBeUndefined()
    expect(captureAgentHit(client, { url: 'https://example.com/api/x', userAgent: GPTBOT_UA }, { ignorePaths: ['/api/*'] })).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('agentMiddleware (Express/Connect)', () => {
  it('captures agent requests and always calls next()', async () => {
    const { client, fetch } = createClient()
    const mw = agentMiddleware(client)
    const next = vi.fn()

    mw(
      {
        method: 'GET',
        originalUrl: '/menu',
        headers: { host: 'example.com', 'user-agent': PERPLEXITY_UA },
        protocol: 'https',
      },
      {},
      next,
    )

    expect(next).toHaveBeenCalledTimes(1)
    const payload = await sentPayload(fetch)
    expect(payload.page_url).toBe('https://example.com/menu')
    expect(payload.user_agent).toBe(PERPLEXITY_UA)
  })

  it('calls next() and sends nothing for humans', () => {
    const { client, fetch } = createClient()
    const next = vi.fn()
    agentMiddleware(client)(
      { method: 'GET', originalUrl: '/', headers: { host: 'example.com', 'user-agent': CHROME_UA } },
      {},
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls next() even when capture throws internally', () => {
    const { client } = createClient()
    const next = vi.fn()
    // headers access will throw
    const badReq = { method: 'GET', get headers(): Record<string, string> { throw new Error('boom') } }
    agentMiddleware(client)(badReq as never, {}, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('trackAgentRequest (WHATWG fetch runtimes)', () => {
  it('captures from a standard Request object', async () => {
    const { client, fetch } = createClient()
    const request = new Request('https://example.com/docs', {
      headers: { 'User-Agent': GPTBOT_UA, Referer: 'https://perplexity.ai/' },
    })

    const agent = trackAgentRequest(client, request)
    expect(agent).toBe('GPTBot')
    const payload = await sentPayload(fetch)
    expect(payload.page_path).toBe('/docs')
  })
})
