/**
 * Metrone React Integration
 * React components and hooks for easy analytics integration
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Metrone, AnalyticsConfig, EventData, CampaignData, SessionInfo, DeviceInfo, LocationInfo } from '@metrone-io/sdk'

interface AnalyticsContextValue {
  analytics: Metrone | null
  isInitialized: boolean
  session: SessionInfo | null
  device: DeviceInfo | null
  location: LocationInfo | null
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

export interface MetroneProviderProps {
  config: AnalyticsConfig
  children: ReactNode
  /**
   * @deprecated The SDK now handles SPA route tracking automatically via
   * `autoTrackSPA` (default: true). This prop is ignored and will be
   * removed in a future version.
   */
  trackRouteChanges?: boolean
  eventPrefix?: string
}

export function MetroneProvider({
  config,
  children,
}: MetroneProviderProps) {
  const [analytics, setAnalytics] = useState<Metrone | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [location, setLocation] = useState<LocationInfo | null>(null)

  useEffect(() => {
    try {
      const analyticsInstance = new Metrone(config)
      setAnalytics(analyticsInstance)
      setIsInitialized(true)

      const sessionInfo: SessionInfo = {
        sessionId: analyticsInstance.getSessionId(),
        startTime: new Date(),
        lastActivity: new Date(),
        duration: 0,
        pageViews: 0,
        eventCount: 0
      }
      setSession(sessionInfo)

      const deviceInfo: DeviceInfo = {
        type: analyticsInstance.getScreenSize() as 'mobile' | 'tablet' | 'desktop',
        width: window.screen.width,
        height: window.screen.height,
        browser: getBrowserName(),
        os: getOSName(),
        userAgent: navigator.userAgent
      }
      setDevice(deviceInfo)

      setLocation({})

      return () => {
        analyticsInstance.destroy()
      }
    } catch (error) {
      console.error('[MetroneProvider] Failed to initialize:', error)
    }
  }, [config])

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

export interface UseMetroneReturn {
  analytics: Metrone | null
  isInitialized: boolean
  trackPageView: (url?: string, title?: string, metadata?: EventData) => void
  trackEvent: (eventName: string, data?: EventData) => void
  trackConversion: (conversionType: string, value?: number, data?: EventData) => void
  trackInteraction: (action: string, element?: string, data?: EventData) => void
  trackCampaign: (campaignData: CampaignData) => void
  trackProductView: (productId: string, productName: string, price?: number, metadata?: EventData) => void
  trackWhatsAppClick: (productId?: string, productName?: string) => void
  trackAICall: (data: { call_id: string; provider?: string; duration?: number; intent?: string; transcript_snippet?: string; outcome?: string; metadata?: EventData }) => void
  trackAIChat: (data: { session_id: string; provider?: string; message_count?: number; intent?: string; resolved?: boolean; duration?: number; metadata?: EventData }) => void
  trackAIIntent: (data: { intent: string; confidence?: number; source?: 'voice' | 'chat' | 'assistant'; metadata?: EventData }) => void
  trackAISession: (data: { session_id: string; provider?: string; action: 'start' | 'end' | 'timeout'; duration?: number; metadata?: EventData }) => void
  flush: () => void
  hasConsent: () => boolean
  requestConsent: () => Promise<boolean>
  revokeConsent: () => void
}

export function useMetrone(): UseMetroneReturn {
  const context = useContext(AnalyticsContext)

  if (!context) {
    throw new Error('useMetrone must be used within a MetroneProvider')
  }

  const { analytics, isInitialized } = context

  const trackPageView = useCallback((url?: string, title?: string, metadata?: EventData) => {
    analytics?.pageview(url, title, metadata)
  }, [analytics])

  const trackEvent = useCallback((eventName: string, data?: EventData) => {
    analytics?.track(eventName, data)
  }, [analytics])

  const trackConversion = useCallback((conversionType: string, value?: number, data?: EventData) => {
    analytics?.conversion(conversionType, value, data)
  }, [analytics])

  const trackInteraction = useCallback((action: string, element?: string, data?: EventData) => {
    analytics?.interaction(action, element, data)
  }, [analytics])

  const trackCampaign = useCallback((campaignData: CampaignData) => {
    analytics?.campaign(campaignData)
  }, [analytics])

  const trackProductView = useCallback((productId: string, productName: string, price?: number, metadata?: EventData) => {
    analytics?.productView(productId, productName, price, metadata)
  }, [analytics])

  const trackWhatsAppClick = useCallback((productId?: string, productName?: string) => {
    analytics?.whatsAppClick(productId, productName)
  }, [analytics])

  const trackAICall = useCallback((data: Parameters<Metrone['trackAICall']>[0]) => {
    analytics?.trackAICall(data)
  }, [analytics])

  const trackAIChat = useCallback((data: Parameters<Metrone['trackAIChat']>[0]) => {
    analytics?.trackAIChat(data)
  }, [analytics])

  const trackAIIntent = useCallback((data: Parameters<Metrone['trackAIIntent']>[0]) => {
    analytics?.trackAIIntent(data)
  }, [analytics])

  const trackAISession = useCallback((data: Parameters<Metrone['trackAISession']>[0]) => {
    analytics?.trackAISession(data)
  }, [analytics])

  const flush = useCallback(() => {
    analytics?.flush()
  }, [analytics])

  const hasConsent = useCallback(() => {
    return analytics ? analytics.hasConsent() : false
  }, [analytics])

  const requestConsent = useCallback(async () => {
    return analytics ? analytics.requestConsent() : false
  }, [analytics])

  const revokeConsent = useCallback(() => {
    analytics?.revokeConsent()
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

export function withMetrone<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    trackPageViews?: boolean
    trackInteractions?: boolean
  } = {}
) {
  return function MetroneWrappedComponent(props: P) {
    const analytics = useMetrone()

    useEffect(() => {
      if (options.trackPageViews && analytics.isInitialized) {
        analytics.trackPageView()
      }
    }, [options.trackPageViews, analytics.isInitialized])

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
        return () => document.removeEventListener('click', handleClick)
      }
    }, [options.trackInteractions, analytics.isInitialized])

    return <Component {...props} />
  }
}

function getBrowserName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  if (ua.includes('Opera')) return 'Opera'
  return 'Unknown'
}

function getOSName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS')) return 'iOS'
  return 'Unknown'
}

export type { MetroneProviderProps, UseMetroneReturn, EventData, CampaignData, AnalyticsConfig }
