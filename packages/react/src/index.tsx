/**
 * Metrone React Integration
 * React components and hooks for easy analytics integration
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Metrone, AnalyticsConfig, AnalyticsContextValue, UseAnalyticsReturn, EventData, CampaignData, SessionInfo, DeviceInfo, LocationInfo } from '@metrone-io/sdk'

// Create analytics context
const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

// Analytics Provider Props
export interface MetroneProviderProps {
  /** Analytics configuration */
  config: AnalyticsConfig
  /** Child components */
  children: ReactNode
  /** Whether to auto-track route changes */
  trackRouteChanges?: boolean
  /** Custom event prefix */
  eventPrefix?: string
}

// Analytics Provider Component
export function MetroneProvider({ 
  config, 
  children, 
  trackRouteChanges = true,
  eventPrefix = ''
}: MetroneProviderProps) {
  const [analytics, setAnalytics] = useState<Metrone | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [location, setLocation] = useState<LocationInfo | null>(null)

  // Initialize analytics
  useEffect(() => {
    try {
      const analyticsInstance = new Metrone(config)
      setAnalytics(analyticsInstance)
      setIsInitialized(true)

      // Set up session info
      const sessionInfo: SessionInfo = {
        sessionId: analyticsInstance.getSessionId(),
        startTime: new Date(),
        lastActivity: new Date(),
        duration: 0,
        pageViews: 0,
        eventCount: 0
      }
      setSession(sessionInfo)

      // Set up device info
      const deviceInfo: DeviceInfo = {
        type: analyticsInstance.getScreenSize() as 'mobile' | 'tablet' | 'desktop',
        width: window.screen.width,
        height: window.screen.height,
        browser: getBrowserName(),
        os: getOSName(),
        userAgent: navigator.userAgent
      }
      setDevice(deviceInfo)

      // Set up location info (will be populated by API)
      const locationInfo: LocationInfo = {}
      setLocation(locationInfo)

      // Track route changes if enabled
      if (trackRouteChanges) {
        trackRouteChange()
      }

      // Set up event listeners
      setupEventListeners(analyticsInstance)

      // Cleanup on unmount
      return () => {
        analyticsInstance.destroy()
      }
    } catch (error) {
      console.error('Failed to initialize Metrone Analytics:', error)
    }
  }, [config, trackRouteChanges])

  // Track route changes
  const trackRouteChange = useCallback(() => {
    if (!analytics) return

    const handleRouteChange = () => {
      analytics.pageview()
      
      // Update session info
      setSession(prev => prev ? {
        ...prev,
        lastActivity: new Date(),
        duration: Date.now() - prev.startTime.getTime(),
        pageViews: prev.pageViews + 1
      } : null)
    }

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange)

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      handleRouteChange()
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      handleRouteChange()
    }

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [analytics])

  // Set up event listeners
  const setupEventListeners = useCallback((analyticsInstance: Metrone) => {
    // Listen for custom analytics events
    const handleAnalyticsEvent = (event: CustomEvent) => {
      if (event.type === 'metrone-update') {
        console.log('📢 SDK update available:', event.detail)
      } else if (event.type === 'metrone-consent-request') {
        // Handle consent request
        const { resolve } = event.detail
        // You can implement your own consent UI here
        resolve(true) // Default to accepting consent
      } else if (event.type === 'metrone-consent-revoked') {
        console.log('🔒 Consent revoked')
      } else if (event.type === 'metrone-error') {
        console.error('Analytics error:', event.detail)
      } else if (event.type === 'metrone-flush') {
        console.log('📦 Events flushed:', event.detail.eventCount)
      } else if (event.type === 'metrone-online') {
        console.log('🌐 Back online')
      } else if (event.type === 'metrone-offline') {
        console.log('📴 Gone offline, queued events:', event.detail.queuedEvents)
      }
    }

    window.addEventListener('metrone-update', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-consent-request', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-consent-revoked', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-error', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-flush', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-online', handleAnalyticsEvent as EventListener)
    window.addEventListener('metrone-offline', handleAnalyticsEvent as EventListener)

    return () => {
      window.removeEventListener('metrone-update', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-consent-request', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-consent-revoked', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-error', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-flush', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-online', handleAnalyticsEvent as EventListener)
      window.removeEventListener('metrone-offline', handleAnalyticsEvent as EventListener)
    }
  }, [])

  // Context value
  const contextValue: AnalyticsContextValue = {
    analytics,
    isInitialized,
    session,
    device,
    location
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  )
}

// Hook to use analytics
export function useMetrone(): UseAnalyticsReturn {
  const context = useContext(AnalyticsContext)
  
  if (!context) {
    throw new Error('useMetrone must be used within a MetroneProvider')
  }

  const { analytics, isInitialized } = context

  // Track page view
  const trackPageView = useCallback((url?: string, title?: string, metadata?: EventData) => {
    if (analytics) {
      analytics.pageview(url, title, metadata)
    }
  }, [analytics])

  // Track custom event
  const trackEvent = useCallback((eventName: string, data?: EventData) => {
    if (analytics) {
      analytics.track(eventName, data)
    }
  }, [analytics])

  // Track conversion
  const trackConversion = useCallback((conversionType: string, value?: number, data?: EventData) => {
    if (analytics) {
      analytics.conversion(conversionType, value, data)
    }
  }, [analytics])

  // Track interaction
  const trackInteraction = useCallback((action: string, element?: string, data?: EventData) => {
    if (analytics) {
      analytics.interaction(action, element, data)
    }
  }, [analytics])

  // Track campaign
  const trackCampaign = useCallback((campaignData: CampaignData) => {
    if (analytics) {
      analytics.campaign(campaignData)
    }
  }, [analytics])

  // Track product view
  const trackProductView = useCallback((productId: string, productName: string, price?: number, metadata?: EventData) => {
    if (analytics) {
      analytics.productView(productId, productName, price, metadata)
    }
  }, [analytics])

  // Track WhatsApp click
  const trackWhatsAppClick = useCallback((productId?: string, productName?: string) => {
    if (analytics) {
      analytics.whatsAppClick(productId, productName)
    }
  }, [analytics])

  // Track AI call
  const trackAICall = useCallback((data: {
    call_id: string
    provider?: string
    duration?: number
    intent?: string
    transcript_snippet?: string
    outcome?: string
    metadata?: EventData
  }) => {
    if (analytics) {
      analytics.trackAICall(data)
    }
  }, [analytics])

  // Track AI chat
  const trackAIChat = useCallback((data: {
    session_id: string
    provider?: string
    message_count?: number
    intent?: string
    resolved?: boolean
    duration?: number
    metadata?: EventData
  }) => {
    if (analytics) {
      analytics.trackAIChat(data)
    }
  }, [analytics])

  // Track AI intent
  const trackAIIntent = useCallback((data: {
    intent: string
    confidence?: number
    source?: 'voice' | 'chat' | 'assistant'
    metadata?: EventData
  }) => {
    if (analytics) {
      analytics.trackAIIntent(data)
    }
  }, [analytics])

  // Track AI session
  const trackAISession = useCallback((data: {
    session_id: string
    provider?: string
    action: 'start' | 'end' | 'timeout'
    duration?: number
    metadata?: EventData
  }) => {
    if (analytics) {
      analytics.trackAISession(data)
    }
  }, [analytics])

  // Flush events
  const flush = useCallback(() => {
    if (analytics) {
      analytics.flush()
    }
  }, [analytics])

  // Check consent
  const hasConsent = useCallback(() => {
    return analytics ? analytics.hasConsent() : false
  }, [analytics])

  // Request consent
  const requestConsent = useCallback(async () => {
    return analytics ? analytics.requestConsent() : false
  }, [analytics])

  // Revoke consent
  const revokeConsent = useCallback(() => {
    if (analytics) {
      analytics.revokeConsent()
    }
  }, [analytics])

  return {
    analytics,
    isInitialized,
    trackPageView,
    trackEvent,
    trackConversion,
    trackInteraction,
    trackCampaign,
    trackProductView,
    trackWhatsAppClick,
    trackAICall,
    trackAIChat,
    trackAIIntent,
    trackAISession,
    flush,
    hasConsent,
    requestConsent,
    revokeConsent
  }
}

// Hook for analytics with options
export function useAnalytics(options: {
  autoTrack?: boolean
  trackRouteChanges?: boolean
  eventPrefix?: string
} = {}): UseAnalyticsReturn {
  const analytics = useMetrone()
  
  // Auto-track page views if enabled
  useEffect(() => {
    if (options.autoTrack && analytics.isInitialized) {
      analytics.trackPageView()
    }
  }, [options.autoTrack, analytics.isInitialized])

  // Track route changes if enabled
  useEffect(() => {
    if (options.trackRouteChanges && analytics.isInitialized) {
      const handleRouteChange = () => {
        analytics.trackPageView()
      }

      window.addEventListener('popstate', handleRouteChange)
      
      return () => {
        window.removeEventListener('popstate', handleRouteChange)
      }
    }
  }, [options.trackRouteChanges, analytics.isInitialized])

  return analytics
}

// Higher-order component for analytics
export function withMetrone<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    trackPageViews?: boolean
    trackInteractions?: boolean
    eventPrefix?: string
  } = {}
) {
  return function MetroneWrappedComponent(props: P) {
    const analytics = useMetrone()

    // Track page views if enabled
    useEffect(() => {
      if (options.trackPageViews && analytics.isInitialized) {
        analytics.trackPageView()
      }
    }, [options.trackPageViews, analytics.isInitialized])

    // Track interactions if enabled
    useEffect(() => {
      if (options.trackInteractions && analytics.isInitialized) {
        const handleClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement
          if (target) {
            analytics.trackInteraction('click', target.tagName.toLowerCase(), {
              id: target.id,
              className: target.className,
              text: target.textContent?.substring(0, 100)
            })
          }
        }

        document.addEventListener('click', handleClick)
        
        return () => {
          document.removeEventListener('click', handleClick)
        }
      }
    }, [options.trackInteractions, analytics.isInitialized])

    return <Component {...props} />
  }
}

// Utility functions
function getBrowserName(): string {
  const userAgent = navigator.userAgent
  
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  if (userAgent.includes('Opera')) return 'Opera'
  
  return 'Unknown'
}

function getOSName(): string {
  const userAgent = navigator.userAgent
  
  if (userAgent.includes('Windows')) return 'Windows'
  if (userAgent.includes('Mac')) return 'macOS'
  if (userAgent.includes('Linux')) return 'Linux'
  if (userAgent.includes('Android')) return 'Android'
  if (userAgent.includes('iOS')) return 'iOS'
  
  return 'Unknown'
}

// Export types
export type {
  MetroneProviderProps,
  AnalyticsContextValue,
  UseAnalyticsReturn
} from '@metrone-io/sdk'
