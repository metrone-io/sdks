# @metrone-io/react

React bindings for [Metrone](https://metrone.io) analytics.

Provider component, hooks, and HOC for integrating Metrone into React and Next.js applications.

## Install

```bash
npm install @metrone-io/react @metrone-io/sdk
```

## Usage

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
  const { trackEvent, trackConversion, trackAICall } = useMetrone()
  return (
    <button onClick={() => trackEvent('button_click', { button_id: 'cta' })}>
      Click Me
    </button>
  )
}
```

## API

- **`MetroneProvider`** — Context provider, initializes the SDK
- **`useMetrone()`** — Hook returning all tracking methods
- **`withMetrone(Component)`** — HOC injecting Metrone props
- **Automatic route tracking** — SPA pageviews handled by the SDK (`autoTrackSPA: true`)
- **Automatic click tracking** — Outbound links, tel:, mailto:, downloads, and `data-track` elements

### Available tracking methods from `useMetrone()`

| Method | Description |
|--------|-------------|
| `trackEvent(name, data?)` | Track a custom event |
| `trackConversion(type, value?, data?)` | Track a conversion |
| `trackPageView(url?, title?)` | Manually track a pageview |
| `trackAICall(data)` | Track an AI voice call |
| `trackAIChat(data)` | Track an AI chat session |
| `trackAIIntent(data)` | Track AI intent detection |
| `trackAISession(data)` | Track AI session lifecycle |
| `flush()` | Flush pending events |

## Human vs AI traffic

Events are classified at ingest as human or AI automatically. Visitors
arriving from ChatGPT, Gemini, Perplexity, Claude, and other AI platforms
are grouped under canonical AI sources on the Metrone **AI Traffic**
dashboard — no extra code in your React app. To also capture AI agents
that fetch your pages without running JavaScript (GPTBot, ChatGPT-User,
PerplexityBot, …), add [server-side or edge capture](https://metrone.io/docs#agent-capture).

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
