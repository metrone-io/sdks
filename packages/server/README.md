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

// Track events (queued for batch sending, returns void)
metrone.track('user_signup', { properties: { plan: 'pro' } })

// Track AI interactions
metrone.trackAICall({
  call_id: 'call_123',
  provider: 'openai',
  duration: 120,
  intent: 'booking',
  outcome: 'converted'
})

// Read analytics (async)
const stats = await metrone.getStats({ days: 7 })
const pages = await metrone.getPages({ days: 7, limit: 10 })
const live = await metrone.getLive()

// Flush and shut down before process exit
await metrone.shutdown()
```

## AI agent capture

AI agents (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, …) fetch your
pages without executing JavaScript, so browser analytics never sees them.
Capture them where the request is served and they appear on the Metrone
**AI Traffic** dashboard. Only known AI agents are forwarded — human
traffic is never sent from here.

```javascript
import { MetroneServer, agentMiddleware } from '@metrone-io/server'

const metrone = new MetroneServer({ apiKey: process.env.METRONE_API_KEY })

// Express / Connect — one line, mounted before routing
app.use(agentMiddleware(metrone))
```

```javascript
// Fetch-style runtimes (Hono, Next.js middleware, Bun, Deno, Workers).
// In serverless, use batchSize: 0 so hits send immediately.
import { MetroneServer, trackAgentRequest } from '@metrone-io/server'

const metrone = new MetroneServer({ apiKey: process.env.METRONE_API_KEY, batchSize: 0 })

export function middleware(request) {
  trackAgentRequest(metrone, request) // fire-and-forget, never throws
  return NextResponse.next()
}
```

Static assets are skipped automatically; pass `{ ignorePaths: ['/api/*'] }`
to exclude more. The original User-Agent is forwarded for classification
only and is never stored by Metrone.

On Cloudflare? Use the zero-code-change [edge Worker template](https://metrone.io/docs#agent-capture) instead.

## Features

- Zero runtime dependencies
- Event tracking with batching and retries
- AI agent capture middleware (GPTBot, ChatGPT, Perplexity, Claude, …)
- AI call and chat session tracking
- Read API for stats, pages, sources, events
- Live visitor count
- Works on Node.js 18+, Deno, Bun, Cloudflare Workers

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
