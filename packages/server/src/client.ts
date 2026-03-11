/**
 * MetroneServer — the main server-side SDK client.
 *
 * Zero dependencies. Uses global fetch (Node 18+, Deno, Bun, edge runtimes).
 * Runtime-agnostic: no DOM, no window, no navigator, no localStorage.
 *
 * Features:
 *  - Event ingestion (single + batch) with automatic batching
 *  - AI tracking (calls, chats, intents, sessions)
 *  - Read API (stats, events, pages, sources, live)
 *  - Retry with exponential backoff + jitter
 *  - Idempotency key support
 *  - Agent identity tracking
 *  - Graceful shutdown with flush()
 */

import type {
  MetroneServerConfig,
  ResolvedConfig,
  EventPayload,
  AICallData,
  AIChatData,
  AIIntentData,
  AISessionData,
  ConversionData,
  StatsParams,
  EventsParams,
  PagesParams,
  SourcesParams,
  FlushResult,
  StatsResponse,
  EventsResponse,
  PagesResponse,
  SourcesResponse,
  LiveResponse,
  ApiResponse,
} from './types.js'
import { MetroneConfigError, MetroneValidationError } from './errors.js'
import { httpPost, httpGet, withRetry } from './http.js'

const API_KEY_PATTERN = /^(metrone_(live|test)_|mk_(live|test)_)[a-f0-9]{32}$/

export class MetroneServer {
  private readonly config: ResolvedConfig
  private queue: Array<EventPayload & { api_key: string }> = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private flushing = false
  private destroyed = false

  constructor(config: MetroneServerConfig) {
    if (!config.apiKey) {
      throw new MetroneConfigError('apiKey is required')
    }
    if (!API_KEY_PATTERN.test(config.apiKey)) {
      throw new MetroneConfigError(
        'Invalid apiKey format. Expected metrone_live_*, metrone_test_*, mk_live_*, or mk_test_* followed by 32 hex chars.',
      )
    }

    const endpoint = (config.endpoint ?? 'https://api.metrone.io').replace(/\/+$/, '')

    this.config = {
      apiKey: config.apiKey,
      endpoint,
      batchSize: config.batchSize ?? 10,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseMs: config.retryBaseMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 10_000,
      maxQueueSize: config.maxQueueSize ?? 1000,
      debug: config.debug ?? false,
      fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    }

    if (this.config.batchSize > 0 && this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(err => {
          if (this.config.debug) {
            console.error('[metrone] Auto-flush error:', err)
          }
        })
      }, this.config.flushIntervalMs)

      if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
        (this.flushTimer as NodeJS.Timeout).unref()
      }
    }

    if (this.config.debug) {
      console.error(`[metrone] Server SDK initialized (endpoint: ${this.config.endpoint})`)
    }
  }

  // ─── Event Tracking ────────────────────────────────────────────────────────

  /**
   * Track a custom event. Queued for batch sending unless batchSize is 0.
   */
  track(eventType: string, data?: Partial<EventPayload>): void {
    this.assertNotDestroyed()
    if (!eventType) throw new MetroneValidationError([{ field: 'event_type', message: 'required' }])

    const event: EventPayload & { api_key: string } = {
      api_key: this.config.apiKey,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      ...data,
    }

    if (this.config.batchSize <= 0) {
      withRetry(this.config, () => httpPost(this.config, '/v1/events', event)).catch(err => {
        if (this.config.debug) console.error('[metrone] Send error:', err)
      })
      return
    }

    this.queue.push(event)
    if (this.queue.length >= this.config.batchSize) {
      this.flush().catch(err => {
        if (this.config.debug) console.error('[metrone] Flush error:', err)
      })
    }
  }

  /**
   * Track a page view.
   */
  pageview(url: string, title?: string, data?: Partial<EventPayload>): void {
    this.track('pageview', {
      page_url: url,
      page_title: title,
      source: 'web',
      ...data,
    })
  }

  /**
   * Track a conversion event.
   */
  conversion(data: ConversionData): void {
    this.track('conversion', {
      source: 'web',
      properties: {
        conversion_type: data.conversion_type,
        value: data.value,
        currency: data.currency,
        ...data.properties,
      },
    })
  }

  // ─── AI Tracking ───────────────────────────────────────────────────────────

  /**
   * Track an AI voice call.
   */
  trackAICall(data: AICallData): void {
    this.track('ai_call', {
      source: 'voice',
      channel: 'phone',
      ai_provider: data.provider ?? 'unknown',
      ai_call_id: data.call_id,
      ai_intent: data.intent,
      ai_duration_sec: data.duration,
      session_id: data.session_id,
      properties: {
        transcript_snippet: data.transcript_snippet,
        outcome: data.outcome,
        ...data.properties,
      },
    })
  }

  /**
   * Track an AI chat interaction.
   */
  trackAIChat(data: AIChatData): void {
    this.track('ai_chat', {
      source: 'chat',
      channel: 'website',
      ai_provider: data.provider ?? 'unknown',
      ai_session_id: data.session_id,
      ai_intent: data.intent,
      ai_duration_sec: data.duration,
      properties: {
        message_count: data.message_count,
        resolved: data.resolved,
        ...data.properties,
      },
    })
  }

  /**
   * Track an AI intent detection.
   */
  trackAIIntent(data: AIIntentData): void {
    this.track('ai_intent', {
      source: data.source ?? 'assistant',
      ai_intent: data.intent,
      properties: {
        confidence: data.confidence,
        ...data.properties,
      },
    })
  }

  /**
   * Track an AI session lifecycle event (start, end, timeout).
   */
  trackAISession(data: AISessionData): void {
    this.track(`ai_session_${data.action}`, {
      source: 'assistant',
      ai_provider: data.provider ?? 'unknown',
      ai_session_id: data.session_id,
      ai_duration_sec: data.duration,
      properties: data.properties,
    })
  }

  // ─── Read API ──────────────────────────────────────────────────────────────

  /**
   * Get aggregated analytics stats for a time period.
   */
  async getStats(params?: StatsParams): Promise<StatsResponse> {
    this.assertNotDestroyed()
    const qp = this.buildDateParams(params)
    const res = await withRetry(this.config, () =>
      httpGet(this.config, '/v1/api/stats', qp),
    )
    return res.data as StatsResponse
  }

  /**
   * Get individual analytics events with pagination and filters.
   */
  async getEvents(params?: EventsParams): Promise<EventsResponse> {
    this.assertNotDestroyed()
    const qp: Record<string, string | number | undefined> = {
      ...this.buildDateParams(params),
      limit: params?.limit,
      offset: params?.offset,
      event_type: params?.event_type,
      source: params?.source,
    }
    const res = await withRetry(this.config, () =>
      httpGet(this.config, '/v1/api/events', qp),
    )
    return res.data as EventsResponse
  }

  /**
   * Get page analytics broken down by path.
   */
  async getPages(params?: PagesParams): Promise<PagesResponse> {
    this.assertNotDestroyed()
    const qp: Record<string, string | number | undefined> = {
      ...this.buildDateParams(params),
      limit: params?.limit,
    }
    const res = await withRetry(this.config, () =>
      httpGet(this.config, '/v1/api/pages', qp),
    )
    return res.data as PagesResponse
  }

  /**
   * Get traffic source and referrer analytics.
   */
  async getSources(params?: SourcesParams): Promise<SourcesResponse> {
    this.assertNotDestroyed()
    const qp = this.buildDateParams(params)
    const res = await withRetry(this.config, () =>
      httpGet(this.config, '/v1/api/sources', qp),
    )
    return res.data as SourcesResponse
  }

  /**
   * Get real-time live stats (active visitors, today's totals).
   */
  async getLive(): Promise<LiveResponse> {
    this.assertNotDestroyed()
    const res = await withRetry(this.config, () =>
      httpGet(this.config, '/v1/api/live'),
    )
    return res.data as LiveResponse
  }

  // ─── Batch & Lifecycle ─────────────────────────────────────────────────────

  /**
   * Immediately flush all queued events. Returns the result.
   * Safe to call multiple times concurrently — only one flush runs at a time.
   */
  async flush(): Promise<FlushResult> {
    if (this.flushing || this.queue.length === 0) {
      return { sent: 0, failed: 0, errors: [] }
    }

    this.flushing = true
    const batch = this.queue.splice(0, 100)

    try {
      const res = await withRetry(this.config, () =>
        httpPost(this.config, '/v1/events/batch', batch),
      )

      const body = res.data as Record<string, unknown> | undefined
      const accepted = typeof body?.accepted === 'number' ? body.accepted : batch.length

      if (this.config.debug) {
        console.error(`[metrone] Flushed ${accepted}/${batch.length} events`)
      }

      return { sent: accepted, failed: batch.length - accepted, errors: [] }
    } catch (err) {
      this.queue.unshift(...batch)
      if (this.queue.length > this.config.maxQueueSize) {
        this.queue.length = this.config.maxQueueSize
      }

      if (this.config.debug) {
        console.error('[metrone] Flush failed, re-queued:', err)
      }

      return {
        sent: 0,
        failed: batch.length,
        errors: [{ index: -1, error: err instanceof Error ? err.message : String(err) }],
      }
    } finally {
      this.flushing = false

      if (this.queue.length >= this.config.batchSize && this.config.batchSize > 0) {
        this.flush().catch(() => {})
      }
    }
  }

  /**
   * Flush remaining events, stop the auto-flush timer, and mark the
   * client as destroyed. Subsequent calls will throw.
   */
  async shutdown(): Promise<FlushResult> {
    if (this.destroyed) return { sent: 0, failed: 0, errors: [] }

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    const result = await this.flush()
    this.destroyed = true

    if (this.config.debug) {
      console.error('[metrone] Server SDK shut down')
    }

    return result
  }

  /** Number of events currently in the send queue. */
  get queueSize(): number {
    return this.queue.length
  }

  /** Whether shutdown() has been called. */
  get isDestroyed(): boolean {
    return this.destroyed
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new MetroneConfigError('Client has been shut down. Create a new instance.')
    }
  }

  private buildDateParams(
    params?: { days?: number; from?: string | Date; to?: string | Date },
  ): Record<string, string | number | undefined> {
    const result: Record<string, string | number | undefined> = {}
    if (params?.days) result.days = params.days
    if (params?.from) result.from = params.from instanceof Date ? params.from.toISOString() : params.from
    if (params?.to) result.to = params.to instanceof Date ? params.to.toISOString() : params.to
    return result
  }
}
