import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetroneServer } from '../client.js'

const VALID_KEY = 'metrone_live_' + 'a'.repeat(32)
const TEST_KEY = 'metrone_test_' + 'b'.repeat(32)

function mockFetch(status = 200, body: unknown = { ok: true, accepted: 10 }) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function createClient(overrides: Record<string, unknown> = {}) {
  const fetch = mockFetch()
  const client = new MetroneServer({
    apiKey: VALID_KEY,
    endpoint: 'https://test.example.com',
    batchSize: 5,
    flushIntervalMs: 0,
    maxRetries: 0,
    fetch,
    ...overrides,
  })
  return { client, fetch }
}

describe('MetroneServer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Constructor validation ─────────────────────────────────────────

  describe('constructor', () => {
    it('throws when apiKey is missing', () => {
      expect(() => new MetroneServer({ apiKey: '' })).toThrow('apiKey is required')
    })

    it('throws when apiKey has invalid format', () => {
      expect(() => new MetroneServer({ apiKey: 'bad_key_123' })).toThrow('Invalid apiKey format')
    })

    it('accepts metrone_live_ prefix', () => {
      const fetch = mockFetch()
      expect(() => new MetroneServer({
        apiKey: VALID_KEY,
        flushIntervalMs: 0,
        fetch,
      })).not.toThrow()
    })

    it('accepts metrone_test_ prefix', () => {
      const fetch = mockFetch()
      expect(() => new MetroneServer({
        apiKey: TEST_KEY,
        flushIntervalMs: 0,
        fetch,
      })).not.toThrow()
    })

    it('accepts mk_live_ prefix', () => {
      const fetch = mockFetch()
      const key = 'mk_live_' + 'c'.repeat(32)
      expect(() => new MetroneServer({
        apiKey: key,
        flushIntervalMs: 0,
        fetch,
      })).not.toThrow()
    })

    it('rejects key with wrong hex length', () => {
      const key = 'metrone_live_' + 'a'.repeat(16)
      expect(() => new MetroneServer({ apiKey: key })).toThrow('Invalid apiKey format')
    })
  })

  // ── track() and flush() ────────────────────────────────────────────

  describe('track() and flush()', () => {
    it('queues events and flush() sends them', async () => {
      const { client, fetch } = createClient()

      client.track('signup', { properties: { plan: 'pro' } })
      client.track('login')
      expect(client.queueSize).toBe(2)

      await client.flush()

      expect(fetch).toHaveBeenCalledOnce()
      const [url, opts] = fetch.mock.calls[0]
      expect(url).toBe('https://test.example.com/v1/events/batch')
      expect(opts?.method).toBe('POST')

      const body = JSON.parse(opts?.body as string) as unknown[]
      expect(body).toHaveLength(2)
      expect((body[0] as Record<string, unknown>).event_type).toBe('signup')
      expect((body[1] as Record<string, unknown>).event_type).toBe('login')
      expect(client.queueSize).toBe(0)
    })

    it('auto-flushes when batchSize is reached', async () => {
      const fetch = mockFetch()
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        batchSize: 3,
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      client.track('e1')
      client.track('e2')
      expect(fetch).not.toHaveBeenCalled()

      client.track('e3')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    })

    it('sends immediately when batchSize is 0', async () => {
      const fetch = mockFetch()
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        batchSize: 0,
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      client.track('immediate_event')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled())

      const [url] = fetch.mock.calls[0]
      expect(url).toBe('https://test.example.com/v1/events')
    })

    it('returns zero counts when queue is empty', async () => {
      const { client } = createClient()
      const result = await client.flush()
      expect(result).toEqual({ sent: 0, failed: 0, errors: [] })
    })

    it('throws on empty event_type', () => {
      const { client } = createClient()
      expect(() => client.track('')).toThrow()
    })
  })

  // ── Retry logic ────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('retries on 5xx responses', async () => {
      let callCount = 0
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ ok: true, accepted: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        batchSize: 5,
        flushIntervalMs: 0,
        maxRetries: 3,
        retryBaseMs: 1,
        fetch,
      })

      client.track('retry_event')
      await client.flush()

      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('does not retry on 4xx (non-429)', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Bad Request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        batchSize: 5,
        flushIntervalMs: 0,
        maxRetries: 3,
        retryBaseMs: 1,
        fetch,
      })

      client.track('bad_event')
      await client.flush()

      expect(fetch).toHaveBeenCalledOnce()
    })

    it('retries on 429 rate limit', async () => {
      let callCount = 0
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return new Response(
            JSON.stringify({ error: 'Rate limited', retry_after_ms: 1 }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({ ok: true, accepted: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      })

      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        batchSize: 5,
        flushIntervalMs: 0,
        maxRetries: 3,
        retryBaseMs: 1,
        fetch,
      })

      client.track('rate_limited_event')
      await client.flush()

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  // ── shutdown() ─────────────────────────────────────────────────────

  describe('shutdown()', () => {
    it('flushes remaining events and marks destroyed', async () => {
      const { client, fetch } = createClient()

      client.track('before_shutdown')
      const result = await client.shutdown()

      expect(result.sent).toBeGreaterThanOrEqual(0)
      expect(client.isDestroyed).toBe(true)
      expect(fetch).toHaveBeenCalled()
    })

    it('prevents further track() calls after shutdown', async () => {
      const { client } = createClient()
      await client.shutdown()

      expect(() => client.track('after_shutdown')).toThrow('shut down')
    })

    it('prevents read calls after shutdown', async () => {
      const { client } = createClient()
      await client.shutdown()

      await expect(client.getStats()).rejects.toThrow('shut down')
    })

    it('is idempotent — second call returns zero counts', async () => {
      const { client } = createClient()
      await client.shutdown()
      const result = await client.shutdown()
      expect(result).toEqual({ sent: 0, failed: 0, errors: [] })
    })
  })

  // ── AI tracking methods ────────────────────────────────────────────

  describe('AI tracking', () => {
    it('trackAICall() produces correct payload', async () => {
      const { client, fetch } = createClient()

      client.trackAICall({
        call_id: 'call-123',
        provider: 'openai',
        duration: 42,
        intent: 'booking',
        transcript_snippet: 'Hello...',
        outcome: 'success',
        session_id: 'sess-1',
      })

      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      const event = body[0]
      expect(event.event_type).toBe('ai_call')
      expect(event.source).toBe('voice')
      expect(event.channel).toBe('phone')
      expect(event.ai_provider).toBe('openai')
      expect(event.ai_call_id).toBe('call-123')
      expect(event.ai_intent).toBe('booking')
      expect(event.ai_duration_sec).toBe(42)
      expect((event.properties as Record<string, unknown>).outcome).toBe('success')
    })

    it('trackAIChat() produces correct payload', async () => {
      const { client, fetch } = createClient()

      client.trackAIChat({
        session_id: 'chat-sess-1',
        provider: 'anthropic',
        message_count: 5,
        intent: 'support',
        resolved: true,
        duration: 120,
      })

      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      const event = body[0]
      expect(event.event_type).toBe('ai_chat')
      expect(event.source).toBe('chat')
      expect(event.ai_provider).toBe('anthropic')
      expect(event.ai_session_id).toBe('chat-sess-1')
      expect((event.properties as Record<string, unknown>).message_count).toBe(5)
      expect((event.properties as Record<string, unknown>).resolved).toBe(true)
    })

    it('trackAIIntent() produces correct payload', async () => {
      const { client, fetch } = createClient()

      client.trackAIIntent({
        intent: 'purchase',
        confidence: 0.95,
        source: 'voice',
      })

      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      const event = body[0]
      expect(event.event_type).toBe('ai_intent')
      expect(event.source).toBe('voice')
      expect(event.ai_intent).toBe('purchase')
      expect((event.properties as Record<string, unknown>).confidence).toBe(0.95)
    })

    it('trackAISession() produces correct payload for each action', async () => {
      const { client, fetch } = createClient()

      client.trackAISession({
        session_id: 'sess-ai-1',
        provider: 'google',
        action: 'start',
      })
      client.trackAISession({
        session_id: 'sess-ai-1',
        provider: 'google',
        action: 'end',
        duration: 300,
      })

      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      expect(body[0].event_type).toBe('ai_session_start')
      expect(body[0].ai_session_id).toBe('sess-ai-1')
      expect(body[1].event_type).toBe('ai_session_end')
      expect(body[1].ai_duration_sec).toBe(300)
    })
  })

  // ── pageview() and conversion() ───────────────────────────────────

  describe('convenience methods', () => {
    it('pageview() sets correct fields', async () => {
      const { client, fetch } = createClient()

      client.pageview('https://example.com/pricing', 'Pricing')
      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      expect(body[0].event_type).toBe('pageview')
      expect(body[0].page_url).toBe('https://example.com/pricing')
      expect(body[0].page_title).toBe('Pricing')
      expect(body[0].source).toBe('web')
    })

    it('conversion() sets correct fields', async () => {
      const { client, fetch } = createClient()

      client.conversion({
        conversion_type: 'purchase',
        value: 99.99,
        currency: 'USD',
      })
      await client.flush()

      const body = JSON.parse(fetch.mock.calls[0][1]?.body as string) as Record<string, unknown>[]
      expect(body[0].event_type).toBe('conversion')
      const props = body[0].properties as Record<string, unknown>
      expect(props.conversion_type).toBe('purchase')
      expect(props.value).toBe(99.99)
      expect(props.currency).toBe('USD')
    })
  })

  // ── Read API methods ───────────────────────────────────────────────

  describe('read API', () => {
    it('getStats() calls /v1/api/stats', async () => {
      const statsData = { total_events: 100, pageviews: 50 }
      const fetch = mockFetch(200, statsData)
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      const result = await client.getStats({ days: 7 })

      expect(result).toEqual(statsData)
      const [url] = fetch.mock.calls[0]
      expect(url).toContain('/v1/api/stats')
      expect(url).toContain('days=7')
    })

    it('getEvents() calls /v1/api/events with params', async () => {
      const eventsData = { data: [], meta: { limit: 10, offset: 0, count: 0, period: {} } }
      const fetch = mockFetch(200, eventsData)
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      await client.getEvents({ limit: 10, offset: 0, event_type: 'pageview' })

      const [url] = fetch.mock.calls[0]
      expect(url).toContain('/v1/api/events')
      expect(url).toContain('limit=10')
      expect(url).toContain('event_type=pageview')
    })

    it('getPages() calls /v1/api/pages', async () => {
      const fetch = mockFetch(200, { data: [] })
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      await client.getPages({ days: 30 })

      const [url] = fetch.mock.calls[0]
      expect(url).toContain('/v1/api/pages')
    })

    it('getSources() calls /v1/api/sources', async () => {
      const fetch = mockFetch(200, { channels: [], referrers: [] })
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      await client.getSources()

      const [url] = fetch.mock.calls[0]
      expect(url).toContain('/v1/api/sources')
    })

    it('getLive() calls /v1/api/live', async () => {
      const liveData = { active_visitors: 5, today_events: 42 }
      const fetch = mockFetch(200, liveData)
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      const result = await client.getLive()

      expect(result).toEqual(liveData)
      const [url] = fetch.mock.calls[0]
      expect(url).toContain('/v1/api/live')
    })

    it('passes X-Api-Key header on read requests', async () => {
      const fetch = mockFetch(200, {})
      const client = new MetroneServer({
        apiKey: VALID_KEY,
        endpoint: 'https://test.example.com',
        flushIntervalMs: 0,
        maxRetries: 0,
        fetch,
      })

      await client.getLive()

      const opts = fetch.mock.calls[0][1]
      const headers = opts?.headers as Record<string, string>
      expect(headers['X-Api-Key']).toBe(VALID_KEY)
    })
  })
})
