import type { AppProps } from 'next/app'
import { MetroneProvider } from '@metrone-io/react'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MetroneProvider
      config={{
        apiKey: process.env.NEXT_PUBLIC_METRONE_API_KEY!,
        endpoint: process.env.NEXT_PUBLIC_METRONE_ENDPOINT || 'https://api.metrone.io/v1/events',
        debug: process.env.NODE_ENV === 'development'
      }}
    >
      <Component {...pageProps} />
    </MetroneProvider>
  )
}
