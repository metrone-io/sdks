# @metrone-io/server

Server-side SDK for [Metrone](https://metrone.io) analytics. Works with Node.js, Deno, Bun, and edge runtimes.

Track events, AI calls, and conversions from your backend. Read analytics data via the API.

## Install

```bash
npm install @metrone-io/server
```

## Usage

```javascript
import { MetroneServer } from '@metrone-io/server'

const metrone = new MetroneServer({
  apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
})

// Track events
await metrone.track('user_signup', { properties: { plan: 'pro' } })

// Track AI interactions
await metrone.trackAICall({
  call_id: 'call_123',
  provider: 'openai',
  duration: 120,
  intent: 'booking',
  outcome: 'converted'
})

// Read analytics
const stats = await metrone.getStats({ days: 7 })
const pages = await metrone.getPages({ days: 7, limit: 10 })
const live = await metrone.getLiveVisitors()
```

## Features

- Zero runtime dependencies
- Event tracking with batching and retries
- AI call and chat session tracking
- Read API for stats, pages, sources, events
- Live visitor count
- Works on Node.js 18+, Deno, Bun, Cloudflare Workers

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
