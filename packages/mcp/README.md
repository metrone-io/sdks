# @metrone-io/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for [Metrone](https://metrone.io) analytics. Gives AI agents (Claude, GPT, Cursor, etc.) native access to your analytics data.

## Install

```bash
npm install -g @metrone-io/mcp
```

## Setup

Add to your MCP client configuration:

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

## Available Tools

| Tool | Description |
|------|-------------|
| `metrone_get_stats` | Aggregate analytics (pageviews, visitors, bounce rate) |
| `metrone_get_events` | Recent events with filtering |
| `metrone_get_pages` | Top pages by views |
| `metrone_get_sources` | Traffic sources breakdown |
| `metrone_get_live` | Current live visitors |
| `metrone_track_event` | Track a custom event |
| `metrone_track_ai_call` | Track an AI call or chat session |

## Example

Ask your AI agent:

> "How many pageviews did we get this week?"
> "What are our top traffic sources?"
> "Track a conversion event for user signup"

## Documentation

[metrone.io/docs](https://metrone.io/docs)

## License

[MIT](../../LICENSE)
