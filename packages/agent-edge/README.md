# Metrone AI Agent Edge Tracker

A tiny Cloudflare Worker you deploy on **your own zone** that makes AI agent
traffic visible in Metrone. AI agents like GPTBot, ChatGPT-User,
PerplexityBot, and ClaudeBot fetch your pages without executing JavaScript,
so the browser tracker (`m.js`) never sees them. This Worker runs at the
edge in front of your origin, spots those agents by User-Agent, and forwards
each visit to Metrone — where it appears on the **AI Traffic** dashboard.

**Human visitors are never tracked by this Worker.** Regular traffic passes
straight through with zero added latency and zero Metrone quota usage; the
browser tracker keeps handling humans as before.

## How it works

```
AI agent ──▶ your zone (this Worker) ──▶ your origin ──▶ response to agent
                     │
                     └─ (background, after response) ──▶ api.metrone.io/v1/events
```

- The event is sent inside `ctx.waitUntil`, after the response has been
  returned — it cannot slow your site down.
- Strictly fail-open: if Metrone is unreachable or the API key is missing,
  your site serves normally.
- Only successful `text/html` responses to GET/HEAD requests are captured;
  static assets (images, CSS, JS, fonts) are ignored.
- The raw User-Agent is used for classification by Metrone's ingestion
  worker and is never stored.

## Deploy (5 minutes)

1. Clone the public SDK repo and install wrangler:

   ```sh
   git clone https://github.com/metrone-io/sdks
   cd sdks/packages/agent-edge
   npm install
   ```

2. Set your Metrone API key (Dashboard → Settings → API Keys):

   ```sh
   npx wrangler secret put METRONE_API_KEY
   ```

3. Edit `wrangler.toml` and uncomment the `routes` block with your domain:

   ```toml
   routes = [
     { pattern = "example.com/*", zone_name = "example.com" },
     { pattern = "www.example.com/*", zone_name = "example.com" },
   ]
   ```

4. Deploy:

   ```sh
   npx wrangler deploy
   ```

That's it. Agent visits appear on the AI Traffic page within seconds of the
next crawl.

## Not on Cloudflare?

Use the server SDK middleware instead — same capture, running in your app:

```ts
import { MetroneServer, agentMiddleware } from '@metrone-io/server'

const metrone = new MetroneServer({ apiKey: process.env.METRONE_API_KEY! })
app.use(agentMiddleware(metrone)) // Express / Connect

// or, for fetch-style runtimes (Hono, Next.js, Bun, Deno):
// trackAgentRequest(metrone, request)
```

## Detected agents

OpenAI (GPTBot, ChatGPT-User, OAI-SearchBot), Anthropic (ClaudeBot,
Claude-User, Claude-SearchBot), Perplexity (PerplexityBot, Perplexity-User),
Google (GoogleOther, Google-CloudVertexBot, Gemini-Deep-Research), Meta
(Meta-ExternalAgent, Meta-ExternalFetcher), Microsoft (BingPreview), xAI
(GrokBot), DuckDuckGo (DuckAssistBot), Mistral, Cohere, ByteDance
(Bytespider), Amazon (Amazonbot), Apple (Applebot-Extended), Common Crawl
(CCBot), You.com, Timpi, Diffbot.

Metrone's ingestion pipeline performs the authoritative classification, so
new agents added there are recognized even before this Worker's local list
is updated. The same list also lives in `@metrone-io/server`'s
`agent-tracker.ts` — keep the copies in sync when adding agents.
