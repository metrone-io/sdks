/**
 * Metrone SDK - Main Entry Point
 * Privacy-first, first-party web analytics with edge-side includes
 */

// Core SDK
import { Metrone } from './core/Metrone'
export { Metrone, initAnalytics, getAnalytics } from './core/Metrone'

// Types
export type {
  AnalyticsConfig,
  EventData,
  CampaignData,
  UpdateInfo,
  AnalyticsEvent,
  BatchEvent,
  ConversionEvent,
  InteractionEvent,
  ProductViewEvent,
  WhatsAppClickEvent,
  PageViewEvent,
  DeviceInfo,
  LocationInfo,
  SessionInfo,
  AnalyticsStats,
  CampaignStats,
  ProjectInfo,
  ErrorInfo,
  ConsentInfo,
  AnalyticsCustomEvent,
  AnalyticsEventListener,
  AnalyticsSDK,
  AnalyticsProviderProps,
  AnalyticsContextValue,
  UseAnalyticsReturn,
  AnalyticsHookOptions,
  AnalyticsMiddleware,
  AnalyticsPlugin,
  AnalyticsConfigValidation,
  AnalyticsPerformanceMetrics,
  AnalyticsDebugInfo
} from './types'

// Version
export const VERSION = '1.3.0'

// Default export
export default Metrone
