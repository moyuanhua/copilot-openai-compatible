# copilot-openai-compatible

A production-ready **OpenAI-compatible HTTP proxy** that uses the [GitHub Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started) as its backend.

Any tool or library that speaks OpenAI's REST API — including [`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible) — can point at this proxy and use GitHub Copilot models with zero or minimal changes.

---

## Features

| Feature | Details |
|---|---|
| `POST /v1/chat/completions` | Streaming (SSE) and non-streaming, full message history |
| `POST /v1/embeddings` | Structurally compatible stub (1536-dim vectors) |
| `GET /v1/models` | Live model list via Copilot SDK, static fallback |
| Auth | Per-request `PROXY_API_KEY` validation |
| Passthrough mode | Forward client GitHub tokens to the SDK |
| Rate limiting | Per-key (configurable) |
| Observability | Request logging + in-memory metrics at `/metrics` |
| TypeScript | Full type coverage, model-ID autocomplete |
| Docker | Dockerfile + docker-compose |
| Tests | Unit + integration tests with mocked SDK |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/install-copilot-cli) installed and authenticated  
  (`copilot auth login` or `gh auth login`)

### Run locally

```bash
git clone https://github.com/moyuanhua/copilot-openai-compatible.git
cd copilot-openai-compatible
npm install
cp .env.example .env
# Edit .env and set PROXY_API_KEY
npm run build
npm start
```

### Run with Docker

```bash
docker compose up --build
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PROXY_API_KEY` | **(required)** | Secret token clients must send as `Bearer` token |
| `PORT` | `3000` | Port for the HTTP server |
| `GITHUB_TOKEN` / `GH_TOKEN` | — | GitHub PAT for Copilot auth (optional if CLI is logged in) |
| `ENABLE_PASSTHROUGH` | `false` | Allow clients to supply `X-GitHub-Token` header |
| `LOG_LEVEL` | `info` | `none` \| `error` \| `warning` \| `info` \| `debug` |
| `RATE_LIMIT_MAX` | `60` | Max requests per window per key |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in milliseconds |
| `DEFAULT_MODEL` | `gpt-4.1` | Fallback model when client omits model field |
| `CUSTOM_MODEL_MAP` | — | JSON map from client model IDs to Copilot IDs |

---

## Authentication

### Server-side authentication (default)

The proxy uses the GitHub Copilot CLI's stored credentials.  No extra
configuration is needed if `gh auth login` / `copilot auth login` has been run.

Alternatively, set `GITHUB_TOKEN` to a GitHub PAT with Copilot access and the
SDK will use it automatically.

### Passthrough mode

Set `ENABLE_PASSTHROUGH=true` to allow clients to supply their own GitHub token:

```http
Authorization: Bearer <PROXY_API_KEY>
X-GitHub-Token: ghp_...
```

The proxy creates a dedicated Copilot client for that token.  Tokens are **never
logged** or returned in responses.  Only enable this mode when every client with
a valid `PROXY_API_KEY` should be able to use their own Copilot quota.

---

## API Reference

### POST /v1/chat/completions

```json
{
  "model": "gpt-4.1",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is 2 + 2?" }
  ],
  "stream": false
}
```

**Headers:**
```
Authorization: Bearer <PROXY_API_KEY>
```

**Non-streaming response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "gpt-4.1",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "4" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": -1, "completion_tokens": -1, "total_tokens": -1 }
}
```

> Token counts are unavailable from the Copilot SDK and are returned as `-1`.

**Streaming response** (`stream: true`):
```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"},...}]}
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":"4"},...}]}
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop",...}]}
data: [DONE]
```

### POST /v1/embeddings

```json
{
  "model": "text-embedding-ada-002",
  "input": "Hello world"
}
```

Returns a 1536-dimensional unit-normalized stub embedding vector.

### GET /v1/models

Returns the list of models available via the Copilot SDK (with static fallback).

---

## Model Mapping

| Client model ID | Copilot model ID |
|---|---|
| `gpt-4` | `gpt-4.1` |
| `gpt-4-turbo` | `gpt-4.1` |
| `gpt-4o` | `gpt-4o` |
| `gpt-4.1` | `gpt-4.1` |
| `gpt-4.1-mini` | `gpt-4.1-mini` |
| `gpt-4o-mini` | `gpt-4o-mini` |
| `gpt-3.5-turbo` | `gpt-4.1-mini` |
| `claude-3-5-sonnet` | `claude-sonnet-4.5` |
| `claude-3-5-haiku` | `claude-haiku-4.5` |
| `o1` / `o1-mini` / `o3-mini` | (unchanged) |
| any other ID | (passed through unchanged) |

Custom mappings via `CUSTOM_MODEL_MAP`:
```bash
CUSTOM_MODEL_MAP='{"my-model":"gpt-4.1"}'
```

---

## Using with @ai-sdk/openai-compatible

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import type { CopilotModelId } from "copilot-openai-compatible/src/types/models.js";

const provider = createOpenAICompatible<CopilotModelId, CopilotModelId, CopilotModelId>({
  baseURL: "http://localhost:3000/v1",
  name: "copilot-proxy",
  apiKey: process.env.PROXY_API_KEY!,
});

// Non-streaming
const { text } = await generateText({
  model: provider.chatModel("gpt-4.1"),
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});
console.log(text);

// Streaming
const { textStream } = await streamText({
  model: provider.chatModel("gpt-4.1"),
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Tell me a short joke." },
  ],
});
for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

See `examples/client.ts` for more examples including raw `fetch` usage.

---

## Development

```bash
npm install
npm run dev        # Start with hot-reload (tsx watch)
npm test           # Run all tests
npm run test:watch # Watch mode
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # Compile TypeScript
```

---

## Security Considerations

- **PROXY_API_KEY** must be kept secret. Treat it like an API key.
- **Do not log tokens.** The proxy is designed to never write `GITHUB_TOKEN` or `X-GitHub-Token` to logs.
- **Passthrough mode** increases the attack surface. Only enable it when all clients are trusted.
- **Rate limiting** is in-memory. For multi-instance deployments, use a shared store (e.g. Redis) with express-rate-limit's external store option.
- **No HTTPS by default.** Deploy behind a TLS-terminating reverse proxy (nginx, Caddy, cloud load balancer) in production.

---

## Architecture & Design

See [`docs/DESIGN.md`](docs/DESIGN.md) for full design rationale, mapping decisions, streaming semantics, and limitations.
