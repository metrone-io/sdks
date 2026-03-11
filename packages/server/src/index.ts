/**
 * @metrone-io/server — Server-side SDK for Metrone analytics.
 *
 * Works in Node.js 18+, Deno, Bun, Cloudflare Workers, and any runtime
 * with a global fetch(). Zero dependencies.
 *
 * @example
 * ```ts
 * import { MetroneServer } from '@metrone-io/server'
 *
 * const metrone = new MetroneServer({
 *   apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 * })
 *
 * // Track events from your server
 * metrone.track('user_signup', { properties: { plan: 'pro' } })
 *
 * // Track AI interactions
 * metrone.trackAICall({
 *   call_id: 'call_123',
 *   provider: 'openai',
 *   duration: 120,
 *   intent: 'booking',
 *   outcome: 'converted',
 * })
 *
 * // Read analytics
 * const stats = await metrone.getStats({ days: 30 })
 * console.log(stats.unique_visitors)
 *
 * // Graceful shutdown
 * await metrone.shutdown()
 * ```
 */

export { MetroneServer } from './client.js'

export {
  MetroneError,
  MetroneConfigError,
  MetroneAuthError,
  MetroneRateLimitError,
  MetroneQuotaError,
  MetroneNetworkError,
  MetroneTimeoutError,
  MetroneValidationError,
  MetroneServerError,
} from './errors.js'

export type {
  MetroneServerConfig,
  EventPayload,
  EventSource,
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
  ApiResponse,
  ApiError,
  StatsResponse,
  EventsResponse,
  EventRow,
  PagesResponse,
  PageRow,
  SourcesResponse,
  ChannelRow,
  ReferrerRow,
  LiveResponse,
} from './types.js'
