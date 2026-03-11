/**
 * Metrone SDK - TypeScript Types
 * Comprehensive type definitions for the analytics SDK
 */

export interface AnalyticsConfig {
  /** API key for authentication (required) */
  apiKey: string
  /** Project ID for multi-tenant support (optional, derived from API key) */
  projectId?: string
  /** Analytics API endpoint (default: 'https://api.metrone.io/v1/events') */
  endpoint?: string
  /** Batch API endpoint (default: derived from endpoint by appending /batch) */
  batchEndpoint?: string
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Automatically track initial page view (default: true) */
  autoTrack?: boolean
  /** Automatically track SPA route changes via History API (default: false) */
  autoTrackSPA?: boolean
  /** Automatically update SDK — only for script-tag installations (default: false) */
  autoUpdate?: boolean
  /** Batch size for event sending (default: 10) */
  batchSize?: number
  /** Flush interval in milliseconds (default: 5000) */
  flushInterval?: number
  /** Queue events when offline (default: true) */
  offlineQueue?: boolean
  /** Maximum queue size (default: 100) */
  maxQueueSize?: number
  /** Respect Do Not Track header (default: false) */
  respectDoNotTrack?: boolean
  /** Anonymize IP addresses (default: true) */
  anonymizeIP?: boolean
  /** Cookie consent requirement (default: 'optional') */
  cookieConsent?: 'required' | 'optional' | 'none'
}

export interface EventData {
  /** Additional event properties */
  [key: string]: any
}

export interface CampaignData {
  /** Custom campaign source (e.g., 'qr_code', 'flyer') */
  campaign_source?: string
  /** Custom campaign medium (e.g., 'print', 'digital') */
  campaign_medium?: string
  /** Custom campaign name (e.g., 'brussels_promo') */
  campaign_name?: string
  /** Custom campaign content (e.g., 'location_a') */
  campaign_content?: string
  /** Standard UTM source parameter */
  utm_source?: string
  /** Standard UTM medium parameter */
  utm_medium?: string
  /** Standard UTM campaign parameter */
  utm_campaign?: string
  /** Standard UTM content parameter */
  utm_content?: string
  /** Standard UTM term parameter */
  utm_term?: string
}

export interface UpdateInfo {
  /** Whether an update is available */
  available: boolean
  /** Current SDK version */
  current: string
  /** Latest available version */
  latest: string
  /** New features in the update */
  features: string[]
  /** Changelog entries */
  changelog: string[]
}

export interface AnalyticsEvent {
  /** Event type identifier */
  event_type: string
  /** Page URL where event occurred */
  page_url: string
  /** Referrer information */
  referrer?: string
  /** User agent string */
  user_agent?: string
  /** IP address (may be anonymized) */
  ip_address?: string
  /** Country code */
  country?: string
  /** City name */
  city?: string
  /** Device type (mobile, tablet, desktop) */
  device_type?: string
  /** Browser name */
  browser?: string
  /** Operating system */
  os?: string
  /** Session identifier */
  session_id: string
  /** Additional event metadata */
  metadata?: EventData
  /** API key for authentication */
  api_key: string
  /** Event timestamp */
  created_at?: string
}

export interface BatchEvent {
  /** Array of events to send */
  events: AnalyticsEvent[]
  /** Indicates this is a batch request */
  batch: true
}

export interface ConversionEvent extends EventData {
  /** Type of conversion */
  conversion_type: string
  /** Conversion value */
  value?: number
  /** Currency code */
  currency?: string
}

export interface InteractionEvent extends EventData {
  /** Interaction action */
  action: string
  /** Element identifier */
  element?: string
}

export interface ProductViewEvent extends EventData {
  /** Product identifier */
  product_id: string
  /** Product name */
  product_name: string
  /** Product price */
  price?: number
  /** Product category */
  category?: string
}

export interface WhatsAppClickEvent extends EventData {
  /** Product identifier (optional) */
  product_id?: string
  /** Product name (optional) */
  product_name?: string
  /** Contact method */
  contact_method: 'whatsapp'
}

export interface PageViewEvent extends EventData {
  /** Page URL */
  url: string
  /** Page title */
  title: string
  /** Referrer URL */
  referrer?: string
}

export interface DeviceInfo {
  /** Device type */
  type: 'mobile' | 'tablet' | 'desktop'
  /** Screen width */
  width: number
  /** Screen height */
  height: number
  /** Browser name */
  browser: string
  /** Operating system */
  os: string
  /** User agent string */
  userAgent: string
}

export interface LocationInfo {
  /** Country code */
  country?: string
  /** Country name */
  countryName?: string
  /** City name */
  city?: string
  /** Region/state */
  region?: string
  /** Timezone */
  timezone?: string
}

export interface SessionInfo {
  /** Session identifier */
  sessionId: string
  /** Session start time */
  startTime: Date
  /** Last activity time */
  lastActivity: Date
  /** Session duration in milliseconds */
  duration: number
  /** Number of page views in session */
  pageViews: number
  /** Number of events in session */
  eventCount: number
}

export interface AnalyticsStats {
  /** Total number of events */
  totalEvents: number
  /** Total number of page views */
  pageViews: number
  /** Total number of unique visitors */
  uniqueVisitors: number
  /** Total number of conversions */
  conversions: number
  /** Pages per visitor */
  pagesPerVisitor: number
  /** Top pages by views */
  topPages: Array<{
    page: string
    views: number
    uniqueVisitors: number
  }>
  /** Top referrers */
  topReferrers: Array<{
    referrer: string
    visits: number
    percentage: number
  }>
  /** Device type distribution */
  deviceTypes: Array<{
    type: string
    count: number
    percentage: number
  }>
  /** Top countries */
  topCountries: Array<{
    country: string
    visits: number
    percentage: number
  }>
  /** Top cities */
  topCities: Array<{
    city: string
    visits: number
    percentage: number
  }>
  /** Hourly traffic data */
  hourlyData: Array<{
    hour: number
    pageviews: number
    events: number
  }>
}

export interface CampaignStats {
  /** Campaign identifier */
  campaignId: string
  /** Campaign type (custom or utm) */
  campaignType: 'custom' | 'utm'
  /** Number of visits */
  visits: number
  /** Number of conversions */
  conversions: number
  /** Conversion rate percentage */
  conversionRate: number
  /** Last visit timestamp */
  lastVisit: Date
}

export interface ProjectInfo {
  /** Project identifier */
  id: string
  /** Project name */
  name: string
  /** Project domain */
  domain: string
  /** API key */
  apiKey: string
  /** Project settings */
  settings: {
    autoUpdate: boolean
    dataRetention: string
    [key: string]: any
  }
  /** Plan tier */
  planTier: 'starter' | 'professional' | 'enterprise'
  /** Creation date */
  createdAt: Date
  /** Last update date */
  updatedAt: Date
}

export interface ErrorInfo {
  /** Error message */
  message: string
  /** Error code */
  code?: string
  /** Error stack trace */
  stack?: string
  /** Additional error context */
  context?: EventData
}

export interface ConsentInfo {
  /** Whether consent has been given */
  hasConsent: boolean
  /** Consent timestamp */
  timestamp?: Date
  /** Consent method */
  method?: 'explicit' | 'implied' | 'cookie'
  /** Consent scope */
  scope?: string[]
}

export interface UpdateNotificationEvent {
  /** Event type */
  type: 'metrone-update'
  /** Update information */
  detail: UpdateInfo
}

export interface ConsentRequestEvent {
  /** Event type */
  type: 'metrone-consent-request'
  /** Consent request details */
  detail: {
    resolve: (consent: boolean) => void
  }
}

export interface ConsentRevokedEvent {
  /** Event type */
  type: 'metrone-consent-revoked'
  /** Revocation details */
  detail: {
    timestamp: Date
  }
}

export interface AnalyticsErrorEvent {
  /** Event type */
  type: 'metrone-error'
  /** Error details */
  detail: ErrorInfo
}

export interface AnalyticsFlushEvent {
  /** Event type */
  type: 'metrone-flush'
  /** Flush details */
  detail: {
    eventCount: number
    timestamp: Date
  }
}

export interface AnalyticsOnlineEvent {
  /** Event type */
  type: 'metrone-online'
  /** Online event details */
  detail: {
    timestamp: Date
  }
}

export interface AnalyticsOfflineEvent {
  /** Event type */
  type: 'metrone-offline'
  /** Offline event details */
  detail: {
    timestamp: Date
    queuedEvents: number
  }
}

export type AnalyticsCustomEvent = 
  | UpdateNotificationEvent
  | ConsentRequestEvent
  | ConsentRevokedEvent
  | AnalyticsErrorEvent
  | AnalyticsFlushEvent
  | AnalyticsOnlineEvent
  | AnalyticsOfflineEvent

export interface AnalyticsEventListener {
  (event: AnalyticsCustomEvent): void
}

export interface AnalyticsSDK {
  /** Whether the SDK is actively tracking (not disabled by DNT/consent) */
  isActive(): boolean

  /** Explicitly start tracking (called automatically unless blocked by DNT/consent) */
  start(): void
  
  /** Track a page view */
  pageview(url?: string, title?: string, metadata?: EventData): void
  
  /** Track a custom event */
  track(eventName: string, data?: EventData): void
  
  /** Track a conversion event */
  conversion(conversionType: string, value?: number, data?: EventData): void
  
  /** Track user interaction */
  interaction(action: string, element?: string, data?: EventData): void
  
  /** Track campaign events */
  campaign(campaignData: CampaignData): void
  
  /** Track campaign with specific event */
  trackCampaign(eventName: string, campaignData: CampaignData, eventData?: EventData): void
  
  /** Track product view */
  productView(productId: string, productName: string, price?: number, metadata?: EventData): void
  
  /** Track WhatsApp click */
  whatsAppClick(productId?: string, productName?: string): void
  
  /** Flush pending events */
  flush(): void
  
  /** Destroy SDK instance and clean up event listeners */
  destroy(): void
  
  /** Get current version */
  getVersion(): string
  
  /** Get session ID */
  getSessionId(): string
  
  /** Get configuration */
  getConfig(): AnalyticsConfig
  
  /** Check for updates (script-tag installations only) */
  checkForUpdates(): Promise<UpdateInfo>
  
  /** Check if user has given consent */
  hasConsent(): boolean
  
  /** Request user consent */
  requestConsent(): Promise<boolean>
  
  /** Revoke user consent */
  revokeConsent(): void
  
  /** Check if running on mobile device */
  isMobile(): boolean
  
  /** Get screen size */
  getScreenSize(): string
  
  /** Anonymize data */
  anonymize(data: string): string
}

export interface AnalyticsProviderProps {
  /** Analytics configuration */
  config: AnalyticsConfig
  /** Child components */
  children: React.ReactNode
}

export interface AnalyticsContextValue {
  /** Analytics SDK instance */
  analytics: AnalyticsSDK | null
  /** Whether analytics is initialized */
  isInitialized: boolean
  /** Current session info */
  session: SessionInfo | null
  /** Device information */
  device: DeviceInfo | null
  /** Location information */
  location: LocationInfo | null
}

export interface UseAnalyticsReturn {
  /** Analytics SDK instance */
  analytics: AnalyticsSDK | null
  /** Whether analytics is initialized */
  isInitialized: boolean
  /** Track page view */
  trackPageView: (url?: string, title?: string, metadata?: EventData) => void
  /** Track custom event */
  trackEvent: (eventName: string, data?: EventData) => void
  /** Track conversion */
  trackConversion: (conversionType: string, value?: number, data?: EventData) => void
  /** Track interaction */
  trackInteraction: (action: string, element?: string, data?: EventData) => void
  /** Track campaign */
  trackCampaign: (campaignData: CampaignData) => void
  /** Track product view */
  trackProductView: (productId: string, productName: string, price?: number, metadata?: EventData) => void
  /** Track WhatsApp click */
  trackWhatsAppClick: (productId?: string, productName?: string) => void
  /** Flush events */
  flush: () => void
  /** Check consent */
  hasConsent: () => boolean
  /** Request consent */
  requestConsent: () => Promise<boolean>
  /** Revoke consent */
  revokeConsent: () => void
}

export interface AnalyticsHookOptions {
  /** Whether to auto-track page views */
  autoTrack?: boolean
  /** Whether to track route changes */
  trackRouteChanges?: boolean
  /** Custom event prefix */
  eventPrefix?: string
}

export interface AnalyticsMiddleware {
  /** Middleware name */
  name: string
  /** Process event before sending */
  processEvent?: (event: AnalyticsEvent) => AnalyticsEvent | null
  /** Process batch before sending */
  processBatch?: (events: AnalyticsEvent[]) => AnalyticsEvent[]
  /** Handle errors */
  handleError?: (error: ErrorInfo) => void
}

export interface AnalyticsPlugin {
  /** Plugin name */
  name: string
  /** Plugin version */
  version: string
  /** Initialize plugin */
  init?: (analytics: AnalyticsSDK) => void
  /** Track event */
  track?: (event: AnalyticsEvent) => void
  /** Track page view */
  pageview?: (event: PageViewEvent) => void
  /** Track conversion */
  conversion?: (event: ConversionEvent) => void
  /** Track interaction */
  interaction?: (event: InteractionEvent) => void
  /** Destroy plugin */
  destroy?: () => void
}

export interface AnalyticsConfigValidation {
  /** Whether config is valid */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
}

export interface AnalyticsPerformanceMetrics {
  /** SDK load time in milliseconds */
  loadTime: number
  /** Event processing time in milliseconds */
  eventProcessingTime: number
  /** Batch processing time in milliseconds */
  batchProcessingTime: number
  /** Network request time in milliseconds */
  networkTime: number
  /** Queue size */
  queueSize: number
  /** Memory usage in bytes */
  memoryUsage: number
}

export interface AnalyticsDebugInfo {
  /** SDK version */
  version: string
  /** Configuration */
  config: AnalyticsConfig
  /** Session info */
  session: SessionInfo
  /** Device info */
  device: DeviceInfo
  /** Location info */
  location: LocationInfo
  /** Performance metrics */
  performance: AnalyticsPerformanceMetrics
  /** Event queue */
  eventQueue: AnalyticsEvent[]
  /** Online status */
  isOnline: boolean
  /** Consent status */
  hasConsent: boolean
  /** Do Not Track status */
  doNotTrack: boolean
}

