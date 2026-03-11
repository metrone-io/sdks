# Metrone SDKs

Official SDKs for [Metrone](https://metrone.io) — privacy-first analytics for humans and AI agents.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@metrone-io/sdk`](packages/sdk) | [![npm](https://img.shields.io/npm/v/@metrone-io/sdk)](https://npmjs.com/package/@metrone-io/sdk) | Browser SDK — pageviews, events, conversions |
| [`@metrone-io/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@metrone-io/react)](https://npmjs.com/package/@metrone-io/react) | React bindings — Provider, hooks, route tracking |
| [`@metrone-io/server`](packages/server) | [![npm](https://img.shields.io/npm/v/@metrone-io/server)](https://npmjs.com/package/@metrone-io/server) | Server SDK — Node, Deno, Bun, edge runtimes |
| [`@metrone-io/mcp`](packages/mcp) | [![npm](https://img.shields.io/npm/v/@metrone-io/mcp)](https://npmjs.com/package/@metrone-io/mcp) | MCP server — analytics for Claude, GPT, and AI agents |

## Quick Start

### Browser

```bash
npm install @metrone-io/sdk
```

```javascript
import Metrone from '@metrone-io/sdk'

const analytics = new Metrone({
  apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpoint: '/api/analytics/events'
})

analytics.pageview()
analytics.track('button_click', { button_id: 'cta' })
```

### React

```bash
npm install @metrone-io/react @metrone-io/sdk
```

```jsx
import { MetroneProvider, useMetrone } from '@metrone-io/react'

function App() {
  return (
    <MetroneProvider
      config={{
        apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        endpoint: '/api/analytics/events'
      }}
    >
      <MyApp />
    </MetroneProvider>
  )
}

function MyComponent() {
  const { trackEvent, trackConversion } = useMetrone()
  return (
    <button onClick={() => trackEvent('button_click', { button_id: 'cta' })}>
      Click Me
    </button>
  )
}
```

### Server (Node / Deno / Bun)

```bash
npm install @metrone-io/server
```

```javascript
import { MetroneServer } from '@metrone-io/server'

const metrone = new MetroneServer({
  apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
})

await metrone.track('user_signup', { properties: { plan: 'pro' } })

await metrone.trackAICall({
  call_id: 'call_123',
  provider: 'openai',
  duration: 120,
  intent: 'booking',
  outcome: 'converted'
})
```

### MCP (AI Agents)

```bash
npm install -g @metrone-io/mcp
```

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "metrone": {
      "command": "npx",
      "args": ["-y", "@metrone-io/mcp"],
      "env": {
        "METRONE_API_KEY": "metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "METRONE_PROJECT_ID": "proj_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Examples

See the [`examples/`](examples) directory for full working examples:

- **[Next.js](examples/nextjs)** — Pages Router with `@metrone-io/react`
- **[Remix](examples/remix)** — React Router with `@metrone-io/react`
- **[Vanilla HTML](examples/vanilla)** — Script tag integration

## Documentation

- [Docs](https://metrone.io/docs) — Full documentation
- [API Playground](https://metrone.io/docs/api-playground) — Interactive API testing
- [REST API Reference](https://metrone.io/docs#reference) — Endpoints and schemas

## Contributing

We welcome contributions. Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/metrone-io/sdks.git
cd sdks
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)
