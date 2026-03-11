# @metrone-io/react

React bindings for [Metrone](https://metrone.io) analytics.

Provider component, hooks, and HOC for integrating Metrone into React and Next.js applications with automatic route tracking.

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
  const { trackEvent, trackConversion } = useMetrone()
  return (
    <button onClick={() => trackEvent('button_click', { button_id: 'cta' })}>
      Click Me
    </button>
  )
}
```

## API

- **`MetroneProvider`** — Context provider, initializes the SDK
- **`useMetrone()`** — Hook returning `{ trackEvent, trackConversion, metrone }`
- **`withMetrone(Component)`** — HOC injecting Metrone props
- **Automatic route tracking** — Pageviews on route changes

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
