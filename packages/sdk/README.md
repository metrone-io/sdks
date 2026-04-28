# @metrone-io/sdk

Privacy-first browser analytics SDK for [Metrone](https://metrone.io).

Lightweight tracking with automatic pageviews, custom events, conversions, AI interaction tracking, batching, retries, and DNT/consent support. No HTTP cookies — uses `sessionStorage` for session continuity and optionally reads `localStorage` for consent state.

## Install

```bash
npm install @metrone-io/sdk
```

## Usage

```javascript
import { Metrone } from '@metrone-io/sdk'

const analytics = new Metrone({
  apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpoint: '/api/analytics/events'
})

analytics.pageview()
analytics.track('button_click', { button_id: 'cta' })
analytics.conversion('purchase', 49.99)
```

### Script tag

```html
<script src="https://your-domain.com/js/metrone.js"></script>
<script>
  var analytics = new Metrone({
    apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    endpoint: '/api/analytics/events'
  })
</script>
```

### AI Tracking

```javascript
analytics.trackAICall({ call_id: 'call_123', provider: 'vapi', duration: 45 })
analytics.trackAIChat({ session_id: 'sess_456', provider: 'intercom', message_count: 8 })
analytics.trackAIIntent({ intent: 'book_appointment', confidence: 0.92, source: 'voice' })
analytics.trackAISession({ session_id: 'sess_456', action: 'end', duration: 120 })
```

### Zero-Code Click Tracking

```html
<button data-track="cta_hero">Get Started</button>
<a href="/pricing" data-track="nav_pricing">Pricing</a>
```

## Features

- No HTTP cookies — uses sessionStorage for sessions, no cross-site tracking
- Automatic SPA route tracking
- Automatic outbound link, tel:, mailto:, and download click tracking
- Zero-code click tracking via `data-track` attribute
- AI voice call, chat, intent, and session tracking
- Event batching with sendBeacon flush on page unload
- Retry logic with exponential backoff
- Idempotency keys to prevent duplicate events
- DNT and consent mode support
- CJS + ESM + IIFE builds

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
