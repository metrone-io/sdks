# @metrone-io/sdk

Privacy-first browser analytics SDK for [Metrone](https://metrone.io).

Lightweight, cookie-free tracking with automatic pageviews, custom events, conversions, AI interaction tracking, batching, retries, and DNT/consent support.

## Install

```bash
npm install @metrone-io/sdk
```

## Usage

```javascript
import Metrone from '@metrone-io/sdk'

const analytics = new Metrone({
  apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpoint: '/api/analytics/events'
})

analytics.pageview()
analytics.track('button_click', { button_id: 'cta' })
analytics.trackConversion('purchase', 49.99)
```

### Script tag

```html
<script src="https://your-domain.com/js/metrone.js"></script>
<script>
  Metrone.init({
    apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    endpoint: '/api/analytics/events'
  })
</script>
```

## Features

- Cookie-free, GDPR-compliant
- Automatic SPA route tracking
- Event batching and retry logic
- DNT and consent mode support
- AI interaction tracking
- UMD + ESM builds

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
