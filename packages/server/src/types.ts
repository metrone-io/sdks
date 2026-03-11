/**
 * Shared types for the Metrone server SDK.
 *
 * These types mirror the Worker's RawEventPayload exactly so payloads pass
 * validation on the ingestion side without translation.
 */

export type EventSource = 'web' | 'voice' | 'chat' | 'assistant' | 'sms' | 'listing'

export interface MetroneServerConfig {
  /** API key (required). Format: metrone_live_* or metrone_test_* */
  apiKey: string

  /** Ingestion endpoint. Default: https://api.metrone.io */
  endpoint?: string

  /** Max events to buffer before auto-flush. 0 = send immediately. Default: 10 */
  batchSize?: number

  /** Milliseconds between auto-flushes. Default: 5000 */
  flushIntervalMs?: number

  /** Max retries per request. Default: 3 */
  maxRetries?: number

  /** Base delay for exponential backoff in ms. Default: 1000 */
  retryBaseMs?: number

  /** Timeout per HTTP request in ms. Default: 10000 */
  timeoutMs?: number

  /** Maximum events to buffer while offline or during backpressure. Default: 1000 */
  maxQueueSize?: number

  /** Enable debug logging to stderr. Default: false */
  debug?: boolean

  /** Custom fetch implementation (for edge runtimes or testing). */
  fetch?: typeof globalThis.fetch
}

export interface ResolvedConfig {
  apiKey: string
  endpoint: string
  batchSize: number
  flushIntervalMs: number
  maxRetries: number
  retryBaseMs: number
  timeoutMs: number
  maxQueueSize: number
  debug: boolean
  fetch: typeof globalThis.fetch
}

export interface EventPayload {
  event_type: string
  event_name?: string
  source?: EventSource
  channel?: string
  page_url?: string
  page_path?: string
  page_title?: string
  referrer?: string
  session_id?: string

  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string

  ai_provider?: string
  ai_call_id?: string
  ai_session_id?: string
  ai_intent?: string
  ai_duration_sec?: number

  /** Agent identification — who sent this event */
  agent_id?: string
  agent_type?: string

  /** Idempotency key to prevent duplicate processing */
  idempotency_key?: string

  properties?: Record<string, unknown>
  timestamp?: string
}

export interface AICallData {
  call_id: string
  provider?: string
  duration?: number
  intent?: string
  transcript_snippet?: string
  outcome?: string
  session_id?: string
  properties?: Record<string, unknown>
}

export interface AIChatData {
  session_id: string
  provider?: string
  message_count?: number
  intent?: string
  resolved?: boolean
  duration?: number
  properties?: Record<string, unknown>
}

export interface AIIntentData {
  intent: string
  confidence?: number
  source?: 'voice' | 'chat' | 'assistant'
  properties?: Record<string, unknown>
}

export interface AISessionData {
  session_id: string
  provider?: string
  action: 'start' | 'end' | 'timeout'
  duration?: number
  properties?: Record<string, unknown>
}

export interface ConversionData {
  conversion_type: string
  value?: number
  currency?: string
  properties?: Record<string, unknown>
}

export interface StatsParams {
  days?: number
  from?: string | Date
  to?: string | Date
}

export interface EventsParams {
  days?: number
  from?: string | Date
  to?: string | Date
  limit?: number
  offset?: number
  event_type?: string
  source?: EventSource
}

export interface PagesParams {
  days?: number
  from?: string | Date
  to?: string | Date
  limit?: number
}

export interface SourcesParams {
  days?: number
  from?: string | Date
  to?: string | Date
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
  retry_after_ms?: number
}

export interface FlushResult {
  sent: number
  failed: number
  errors: Array<{ index: number; error: string }>
}

export interface StatsResponse {
  total_events: number
  pageviews: number
  conversions: number
  unique_visitors: number
  unique_sessions: number
  ai_interactions: number
  conversion_rate: number
  bounce_rate: number
  period: { from: string; to: string }
}

export interface EventRow {
  event_id: string
  timestamp: string
  event_type: string
  event_name: string | null
  source: string
  page_url: string | null
  page_path: string | null
  referrer_domain: string | null
  country_code: string | null
  country: string | null
  region: string | null
  city: string | null
  browser: string | null
  os: string | null
  device_type: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  session_id: string | null
  properties: Record<string, unknown> | null
}

export interface EventsResponse {
  data: EventRow[]
  meta: {
    limit: number
    offset: number
    count: number
    period: { from: string; to: string }
  }
}

export interface PageRow {
  page_path: string
  page_url: string | null
  pageviews: number
  unique_sessions: number
  conversions: number
}

export interface PagesResponse {
  data: PageRow[]
}

export interface ChannelRow {
  source: string
  events: number
  conversions: number
  unique_sessions: number
  share: number
}

export interface ReferrerRow {
  referrer_domain: string
  events: number
  unique_sessions: number
}

export interface SourcesResponse {
  channels: ChannelRow[]
  referrers: ReferrerRow[]
}

export interface LiveResponse {
  active_visitors: number
  today_events: number
  today_pageviews: number
  today_sessions: number
  today_conversions: number
}
