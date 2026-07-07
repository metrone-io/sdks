/**
 * index.test.ts — capture decision logic for the AI Agent Edge Tracker.
 *
 * The invariants that matter:
 *   - AI agent UAs are captured; humans and plain search bots are not
 *   - only successful text/html GET/HEAD responses count
 *   - static assets are ignored even for agents
 *   - the payload forwards the original UA in `user_agent` (Phase-1 worker
 *     contract) and never invents fields the validator would reject
 */

import { describe, it, expect } from 'vitest'
import { isAiAgent, shouldCapture, buildEventPayload } from './index'

const GPTBOT_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'
const CHATGPT_USER_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function makeRequest(ua: string | null, url = 'https://example.com/pricing', method = 'GET'): Request {
  const headers = new Headers()
  if (ua) headers.set('User-Agent', ua)
  return new Request(url, { method, headers })
}

function htmlResponse(status = 200): Response {
  return new Response('<html></html>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

describe('isAiAgent', () => {
  it('matches AI agents', () => {
    expect(isAiAgent(GPTBOT_UA)).toBe(true)
    expect(isAiAgent(CHATGPT_USER_UA)).toBe(true)
    expect(isAiAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe(true)
    expect(isAiAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0)')).toBe(true)
  })

  it('does not match humans or plain search bots', () => {
    expect(isAiAgent(CHROME_UA)).toBe(false)
    expect(isAiAgent(GOOGLEBOT_UA)).toBe(false)
    expect(isAiAgent(null)).toBe(false)
  })
})

describe('shouldCapture', () => {
  it('captures an AI agent fetching an HTML page', () => {
    expect(shouldCapture(makeRequest(GPTBOT_UA), htmlResponse())).toBe(true)
  })

  it('skips human visitors entirely', () => {
    expect(shouldCapture(makeRequest(CHROME_UA), htmlResponse())).toBe(false)
  })

  it('skips plain search crawlers (not AI agents)', () => {
    expect(shouldCapture(makeRequest(GOOGLEBOT_UA), htmlResponse())).toBe(false)
  })

  it('skips static assets even for agents', () => {
    expect(shouldCapture(makeRequest(GPTBOT_UA, 'https://example.com/app.css'), htmlResponse())).toBe(false)
    expect(shouldCapture(makeRequest(GPTBOT_UA, 'https://example.com/logo.png'), htmlResponse())).toBe(false)
    expect(shouldCapture(makeRequest(GPTBOT_UA, 'https://example.com/robots.txt'), htmlResponse())).toBe(false)
  })

  it('skips non-HTML and error responses', () => {
    const json = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    expect(shouldCapture(makeRequest(GPTBOT_UA, 'https://example.com/api/data'), json)).toBe(false)
    expect(shouldCapture(makeRequest(GPTBOT_UA), htmlResponse(404))).toBe(false)
    expect(shouldCapture(makeRequest(GPTBOT_UA), htmlResponse(500))).toBe(false)
  })

  it('skips non-GET methods', () => {
    expect(shouldCapture(makeRequest(GPTBOT_UA, 'https://example.com/form', 'POST'), htmlResponse())).toBe(false)
  })
})

describe('buildEventPayload', () => {
  it('forwards url, path, and original UA under the ingest contract', () => {
    const req = makeRequest(CHATGPT_USER_UA, 'https://example.com/menu?utm_source=x')
    const payload = buildEventPayload(req, 'metrone_live_test')

    expect(payload.api_key).toBe('metrone_live_test')
    expect(payload.event_type).toBe('pageview')
    expect(payload.source).toBe('web')
    expect(payload.page_url).toBe('https://example.com/menu?utm_source=x')
    expect(payload.page_path).toBe('/menu')
    expect(payload.user_agent).toBe(CHATGPT_USER_UA)
    expect(payload.properties).toEqual({ agent_capture: 'edge' })
  })
})
