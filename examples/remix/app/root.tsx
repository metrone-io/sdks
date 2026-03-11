import type { MetaFunction } from "@remix-run/cloudflare";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { MetroneProvider } from '@metrone-io/react'

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Metrone Analytics - Remix Example",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <MetroneProvider
          config={{
            apiKey: 'metrone_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            endpoint: 'https://api.metrone.io/v1/events',
            debug: true
          }}
        >
          <Outlet />
        </MetroneProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
