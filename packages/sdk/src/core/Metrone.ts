/**
 * Metrone SDK - Core
 * Privacy-first, first-party web analytics with multi-tenant support
 */

import type { AnalyticsConfig, EventData, CampaignData, UpdateInfo } from '../types'

export type { AnalyticsConfig, EventData, CampaignData, UpdateInfo }

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

export class Metrone {
  private config: AnalyticsConfig
  private sessionId: string
  private isInitialized: boolean = false
  private trackingActive: boolean = false
  private eventQueue: any[] = []
  private isOnline: boolean = true
  private version: string = '1.3.0'
  private updateCheckInterval: number | null = null
  private flushTimerId: number | null = null
  private boundVisibilityHandler: (() => void) | null = null
  private boundBeforeUnloadHandler: (() => void) | null = null
  private lastTrackedPath: string = ''

  constructor(config: AnalyticsConfig | string) {
    const resolved: AnalyticsConfig = typeof config === 'string' ? { apiKey: config } : config

    this.config = {
      endpoint: 'https://api.metrone.io/v1/events',
      debug: false,
      autoTrack: true,
      autoTrackSPA: false,
      autoUpdate: false,
      batchSize: 10,
      flushInterval: 5000,
      offlineQueue: true,
      maxQueueSize: 100,
      respectDoNotTrack: false,
      anonymizeIP: true,
      cookieConsent: 'optional',
      ...resolved
    }

    if (!this.config.apiKey) {
      throw new Error('[Metrone] API key is required')
    }

    const validPrefixes = ['metrone_live_', 'metrone_test_', 'mk_live_', 'mk_test_']
    if (!validPrefixes.some(p => this.config.apiKey.startsWith(p))) {
      console.error('[Metrone] Invalid API key format. Must start with "metrone_live_", "metrone_test_", "mk_live_", or "mk_test_"')
      this.sessionId = ''
      return
    }

    if (!this.config.batchEndpoint) {
      this.config.batchEndpoint = this.config.endpoint!.replace(/\/events\/?$/, '/events/batch')
    }

    this.sessionId = this.restoreOrCreateSession()
    this.isInitialized = true

    if (this.config.respectDoNotTrack && this.isDoNotTrackEnabled()) {
      console.warn('[Metrone] Do Not Track detected — analytics disabled. Set respectDoNotTrack: false to override.')
      return
    }

    if (this.config.cookieConsent === 'required' && !this.hasConsent()) {
      console.warn('[Metrone] Cookie consent required but not granted — analytics disabled.')
      return
    }

    this.activate()
  }

  /**
   * Explicitly start tracking. Called automatically by the constructor unless
   * tracking is blocked by DNT or consent. Can also be called manually if you
   * want to separate initialization from activation.
   */
  start(): void {
    if (this.trackingActive) return
    if (!this.isInitialized) {
      console.warn('[Metrone] Cannot start — SDK not initialized (check your API key)')
      return
    }
    this.activate()
  }

  private activate(): void {
    this.trackingActive = true

    this.setupOnlineDetection()
    this.setupPageUnloadFlush()

    if (this.config.autoTrack) {
      this.lastTrackedPath = window.location.pathname
      this.pageview()
    }

    if (this.config.autoTrackSPA) {
      this.setupSPATracking()
    }

    if (this.config.batchSize && this.config.batchSize > 1) {
      this.setupBatchProcessing()
    }

    if (this.config.debug) {
      console.log('[Metrone] SDK initialized:', {
        apiKey: this.config.apiKey.substring(0, 12) + '...',
        projectId: this.config.projectId,
        sessionId: this.sessionId,
        endpoint: this.config.endpoint,
        version: this.version
      })
    }
  }

  /**
   * Whether the SDK is actively tracking events (not disabled by DNT/consent).
   */
  isActive(): boolean {
    return this.isInitialized && this.trackingActive
  }

  /**
   * Track a page view
   */
  pageview(url?: string, title?: string, metadata?: EventData): void {
    if (!this.isInitialized || !this.trackingActive) return

    this.track('pageview', {
      page_url:   url || window.location.href,
      page_path:  window.location.pathname,
      page_title: title || document.title,
      referrer:   document.referrer,
      source:     'web',
      ...metadata
    })
  }

  /**
   * Track a custom event
   */
  track(eventName: string, data?: EventData): void {
    if (!this.isInitialized) {
      console.warn('[Metrone] SDK not initialized')
      return
    }
    if (!this.trackingActive) return

    const { source, channel, ai_provider, ai_call_id, ai_session_id,
            ai_intent, ai_duration_sec, utm_source, utm_medium, utm_campaign,
            utm_term, utm_content, page_path, page_title, page_url: dataPageUrl,
            referrer: dataReferrer, event_name, ...rest } = (data ?? {}) as Record<string, unknown>

    const eventData = {
      event_type:      eventName,
      event_name:      event_name as string | undefined,
      page_url:        (dataPageUrl as string) || window.location.href,
      page_path:       (page_path as string) || window.location.pathname,
      page_title:      (page_title as string) || (typeof document !== 'undefined' ? document.title : undefined),
      referrer:        (dataReferrer as string) || (typeof document !== 'undefined' ? document.referrer : undefined),
      session_id:      this.sessionId,
      sdk_version:     this.version,
      timestamp:       new Date().toISOString(),
      source:          source as string | undefined,
      channel:         channel as string | undefined,
      ai_provider:     ai_provider as string | undefined,
      ai_call_id:      ai_call_id as string | undefined,
      ai_session_id:   ai_session_id as string | undefined,
      ai_intent:       ai_intent as string | undefined,
      ai_duration_sec: ai_duration_sec as number | undefined,
      utm_source:      utm_source as string | undefined,
      utm_medium:      utm_medium as string | undefined,
      utm_campaign:    utm_campaign as string | undefined,
      utm_term:        utm_term as string | undefined,
      utm_content:     utm_content as string | undefined,
      properties:      Object.keys(rest).length > 0 ? rest : undefined,
    }

    this.sendEvent(eventData)
  }

  /**
   * Track a conversion event
   */
  conversion(conversionType: string, value?: number, data?: EventData): void {
    this.track('conversion', {
      conversion_type: conversionType,
      value: value,
      currency: 'EUR',
      ...data
    })
  }

  /**
   * Track user interaction (clicks, form submissions, etc.)
   */
  interaction(action: string, element?: string, data?: EventData): void {
    this.track('interaction', {
      action,
      element,
      ...data
    })
  }

  /**
   * Track campaign events
   */
  campaign(campaignData: CampaignData): void {
    this.track('campaign', campaignData)
  }

  /**
   * Track campaign with specific event
   */
  trackCampaign(eventName: string, campaignData: CampaignData, eventData?: EventData): void {
    this.track(eventName, {
      ...campaignData,
      ...eventData
    })
  }

  /**
   * Track product view
   */
  productView(productId: string, productName: string, price?: number, metadata?: EventData): void {
    this.track('product_view', {
      product_id: productId,
      product_name: productName,
      price: price,
      category: 'product',
      ...metadata
    })
  }

  /**
   * Track WhatsApp click
   */
  whatsAppClick(productId?: string, productName?: string): void {
    this.conversion('whatsapp_click', undefined, {
      product_id: productId,
      product_name: productName,
      contact_method: 'whatsapp'
    })
  }

  /**
   * Track AI voice call
   */
  trackAICall(data: {
    call_id: string
    provider?: string
    duration?: number
    intent?: string
    transcript_snippet?: string
    outcome?: string
    metadata?: EventData
  }): void {
    this.track('ai_call', {
      source: 'voice',
      channel: 'phone',
      ai_provider: data.provider || 'unknown',
      ai_call_id: data.call_id,
      ai_intent: data.intent,
      ai_duration_sec: data.duration,
      transcript_snippet: data.transcript_snippet,
      outcome: data.outcome,
      ...data.metadata
    })
  }

  /**
   * Track AI chat interaction
   */
  trackAIChat(data: {
    session_id: string
    provider?: string
    message_count?: number
    intent?: string
    resolved?: boolean
    duration?: number
    metadata?: EventData
  }): void {
    this.track('ai_chat', {
      source: 'chat',
      channel: 'website',
      ai_provider: data.provider || 'unknown',
      ai_session_id: data.session_id,
      ai_intent: data.intent,
      ai_duration_sec: data.duration,
      message_count: data.message_count,
      resolved: data.resolved,
      ...data.metadata
    })
  }

  /**
   * Track AI intent detection
   */
  trackAIIntent(data: {
    intent: string
    confidence?: number
    source?: 'voice' | 'chat' | 'assistant'
    metadata?: EventData
  }): void {
    this.track('ai_intent', {
      source: data.source || 'assistant',
      ai_intent: data.intent,
      confidence: data.confidence,
      ...data.metadata
    })
  }

  /**
   * Track AI session lifecycle
   */
  trackAISession(data: {
    session_id: string
    provider?: string
    action: 'start' | 'end' | 'timeout'
    duration?: number
    metadata?: EventData
  }): void {
    this.track(`ai_session_${data.action}`, {
      source: 'assistant',
      ai_provider: data.provider || 'unknown',
      ai_session_id: data.session_id,
      ai_duration_sec: data.duration,
      ...data.metadata
    })
  }

  private async sendEvent(eventData: any): Promise<void> {
    const requestData = {
      ...eventData,
      api_key: this.config.apiKey
    }

    if (this.config.batchSize && this.config.batchSize > 1) {
      this.eventQueue.push(requestData)
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flushBatch()
      }
    } else {
      try {
        await this.sendRequestWithRetry(this.config.endpoint!, requestData)
      } catch (error) {
        console.warn('[Metrone] Failed to send event:', (error as Error).message)
        this.queueEvent(requestData)
      }
    }
  }

  private async sendRequestWithRetry(url: string, data: any, retries = MAX_RETRIES): Promise<void> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.sendHttp(url, data)

        if (response.ok) {
          if (this.config.debug) {
            console.log('[Metrone] Event sent:', data.event_type ?? 'batch')
          }
          return
        }

        // Don't retry client errors (4xx) except 429 (rate limited)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`${response.status} ${response.statusText}`)
        }

        // Retryable error (5xx or 429)
        if (attempt < retries) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
          await this.sleep(delay)
          continue
        }

        throw new Error(`${response.status} ${response.statusText} after ${retries + 1} attempts`)
      } catch (error) {
        if (attempt < retries && this.isNetworkError(error)) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
          await this.sleep(delay)
          continue
        }
        throw error
      }
    }
  }

  private async sendHttp(url: string, data: any): Promise<{ ok: boolean; status: number; statusText: string }> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return { ok: response.ok, status: response.status, statusText: response.statusText }
    } catch {
      // fetch not available or network failure — try XHR fallback
      return this.sendXhr(url, data)
    }
  }

  private sendXhr(url: string, data: any): Promise<{ ok: boolean; status: number; statusText: string }> {
    return new Promise((resolve, reject) => {
      if (typeof XMLHttpRequest === 'undefined') {
        reject(new Error('No HTTP transport available'))
        return
      }

      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.onload = () => {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, statusText: xhr.statusText })
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.ontimeout = () => reject(new Error('Request timeout'))
      xhr.timeout = 10000
      xhr.send(JSON.stringify(data))
    })
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) return true
    const msg = (error as Error).message?.toLowerCase() ?? ''
    return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async flushBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const batch = [...this.eventQueue]
    this.eventQueue = []

    try {
      await this.sendRequestWithRetry(this.config.batchEndpoint!, batch)

      if (this.config.debug) {
        console.log(`[Metrone] Batch sent: ${batch.length} events`)
      }
    } catch (error) {
      console.warn('[Metrone] Failed to send batch:', (error as Error).message)
      // Restore events to front of queue on any failure (not just offline)
      this.eventQueue.unshift(...batch)
      // Trim to max queue size
      if (this.eventQueue.length > (this.config.maxQueueSize || 100)) {
        this.eventQueue = this.eventQueue.slice(0, this.config.maxQueueSize || 100)
      }
    }
  }

  /**
   * Flush queued events using sendBeacon (survives page unload).
   */
  private beaconFlush(): void {
    if (this.eventQueue.length === 0) return

    const batch = [...this.eventQueue]
    this.eventQueue = []

    try {
      const payload = JSON.stringify(batch)
      const sent = navigator.sendBeacon(this.config.batchEndpoint!, payload)
      if (!sent && this.config.debug) {
        console.warn('[Metrone] sendBeacon failed, events may be lost')
      }
    } catch {
      // sendBeacon not available or failed — nothing we can do at unload time
    }
  }

  private queueEvent(eventData: any): void {
    if (this.eventQueue.length >= (this.config.maxQueueSize || 100)) {
      this.eventQueue.shift()
    }
    this.eventQueue.push(eventData)
  }

  private async processQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return

    const queue = [...this.eventQueue]
    this.eventQueue = []

    let sent = 0
    for (const event of queue) {
      try {
        await this.sendRequestWithRetry(this.config.endpoint!, event, 1)
        sent++
      } catch {
        // Failed even after retry — re-queue and stop processing
        // to avoid hammering a down server
        this.eventQueue.push(event)
      }
    }

    if (this.config.debug) {
      console.log(`[Metrone] Processed queue: ${sent}/${queue.length} sent`)
    }
  }

  private setupOnlineDetection(): void {
    this.isOnline = navigator.onLine

    window.addEventListener('online', () => {
      this.isOnline = true
      if (this.config.debug) {
        console.log('[Metrone] Back online, processing queue')
      }
      this.processQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      if (this.config.debug) {
        console.log('[Metrone] Gone offline, queuing events')
      }
    })
  }

  private setupBatchProcessing(): void {
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.flushTimerId = window.setInterval(() => {
        this.flushBatch()
      }, this.config.flushInterval)
    }
  }

  /**
   * Flush pending events on page hide / beforeunload using sendBeacon.
   */
  private setupPageUnloadFlush(): void {
    this.boundVisibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.beaconFlush()
      }
    }
    this.boundBeforeUnloadHandler = () => {
      this.beaconFlush()
    }

    document.addEventListener('visibilitychange', this.boundVisibilityHandler)
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler)
  }

  /**
   * Auto-track SPA route changes via History API and popstate.
   */
  private setupSPATracking(): void {
    const origPushState = history.pushState.bind(history)
    const origReplaceState = history.replaceState.bind(history)

    const onRouteChange = () => {
      const newPath = window.location.pathname
      if (newPath !== this.lastTrackedPath) {
        this.lastTrackedPath = newPath
        setTimeout(() => this.pageview(), 0)
      }
    }

    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      origPushState(data, unused, url)
      onRouteChange()
    }

    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      origReplaceState(data, unused, url)
      onRouteChange()
    }

    window.addEventListener('popstate', onRouteChange)
  }

  /**
   * Check for SDK updates (only relevant for script-tag installations).
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    if (this.isModuleContext()) {
      if (this.config.debug) {
        console.log('[Metrone] Auto-update is not supported in module/bundler context. Update via npm instead.')
      }
      return {
        available: false,
        current: this.version,
        latest: this.version,
        features: [],
        changelog: []
      }
    }

    try {
      const response = await fetch('/api/analytics/version')
      const updateInfo = await response.json()

      if (updateInfo.latest !== this.version) {
        this.handleUpdate(updateInfo)
      }

      return updateInfo
    } catch (error) {
      if (this.config.debug) {
        console.log('[Metrone] Update check failed:', error)
      }
      return {
        available: false,
        current: this.version,
        latest: this.version,
        features: [],
        changelog: []
      }
    }
  }

  private handleUpdate(updateInfo: UpdateInfo): void {
    if (this.config.autoUpdate !== false && !this.isModuleContext()) {
      this.loadNewVersion(updateInfo.latest)
    } else {
      this.notifyUpdate(updateInfo)
    }
  }

  private loadNewVersion(version: string): void {
    if (this.config.debug) {
      console.log(`[Metrone] Updating SDK to version ${version}`)
    }

    const script = document.createElement('script')
    script.src = '/js/metrone.js'
    script.onload = () => {
      if (this.config.debug) {
        console.log(`[Metrone] SDK updated to version ${version}`)
      }
    }
    document.head.appendChild(script)
  }

  private notifyUpdate(updateInfo: UpdateInfo): void {
    if (this.config.debug) {
      console.log(`[Metrone] SDK update available: ${updateInfo.latest}`)
    }

    window.dispatchEvent(new CustomEvent('metrone-update', {
      detail: updateInfo
    }))
  }

  /**
   * Detect whether the SDK is running inside a bundler/module context
   * vs. a plain script-tag.
   */
  private isModuleContext(): boolean {
    try {
      // If this code is part of a bundle, `module` or import.meta will be defined.
      // The simplest heuristic: check if the current script tag has type="module"
      // or if we're in a context where document.currentScript is null (bundled).
      return typeof document === 'undefined' || document.currentScript === null
    } catch {
      return true
    }
  }

  private static readonly SESSION_KEY = '__metrone_sid'
  private static readonly SESSION_TTL = 30 * 60 * 1000

  private restoreOrCreateSession(): string {
    try {
      if (typeof sessionStorage === 'undefined') return this.generateSessionId()
      const raw = sessionStorage.getItem(Metrone.SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; t: number }
        if (Date.now() - parsed.t < Metrone.SESSION_TTL) {
          parsed.t = Date.now()
          sessionStorage.setItem(Metrone.SESSION_KEY, JSON.stringify(parsed))
          return parsed.id
        }
      }
    } catch { /* sessionStorage unavailable (SSR, iframe sandbox) */ }

    const id = this.generateSessionId()
    try {
      sessionStorage.setItem(Metrone.SESSION_KEY, JSON.stringify({ id, t: Date.now() }))
    } catch { /* best effort */ }
    return id
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    return `sess_${timestamp}_${random}`
  }

  private isDoNotTrackEnabled(): boolean {
    return navigator.doNotTrack === '1' ||
           navigator.doNotTrack === 'yes' ||
           (window as any).doNotTrack === '1'
  }

  hasConsent(): boolean {
    const keys = ['metrone-consent', 'cookie-consent', 'gdpr-consent', 'cc-consent']
    for (const key of keys) {
      const val = localStorage.getItem(key)
      if (val === 'accepted' || val === 'true' || val === '1') return true
      if (val === 'rejected' || val === 'false' || val === '0') return false
    }
    return false
  }

  async requestConsent(): Promise<boolean> {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('metrone-consent-request', {
        detail: { resolve }
      }))
    })
  }

  revokeConsent(): void {
    localStorage.removeItem('cookie-consent')
    localStorage.removeItem('gdpr-consent')
    localStorage.removeItem('cc-consent')

    if (this.config.debug) {
      console.log('[Metrone] Consent revoked, analytics disabled')
    }
  }

  anonymize(data: string): string {
    const hash = this.simpleHash(data)
    return `anon_${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  getScreenSize(): string {
    const width = window.screen.width
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  flush(): void {
    this.flushBatch()
  }

  destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
    }
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId)
    }
    if (this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler)
    }
    if (this.boundBeforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler)
    }

    this.beaconFlush()
    this.isInitialized = false
    this.trackingActive = false

    if (this.config.debug) {
      console.log('[Metrone] SDK destroyed')
    }
  }

  getVersion(): string {
    return this.version
  }

  getSessionId(): string {
    return this.sessionId
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config }
  }
}

let globalAnalytics: Metrone | null = null

export function initAnalytics(config: AnalyticsConfig): Metrone {
  globalAnalytics = new Metrone(config)
  return globalAnalytics
}

export function getAnalytics(): Metrone | null {
  return globalAnalytics
}

if (typeof window !== 'undefined') {
  const config = (window as any).MetroneConfig
  if (config) {
    globalAnalytics = new Metrone(config)
  } else if (document.currentScript) {
    const el = document.currentScript as HTMLScriptElement
    const dataKey = el.getAttribute('data-key')
    const dataApi = el.getAttribute('data-api')
    if (dataKey) {
      globalAnalytics = new Metrone({
        apiKey: dataKey,
        endpoint: dataApi || undefined,
        autoTrack: true,
        autoTrackSPA: true,
      })
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).Metrone = Metrone as any
  (window as any).initAnalytics = initAnalytics as any
  (window as any).getAnalytics = getAnalytics as any
}
