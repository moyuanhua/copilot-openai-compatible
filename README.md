# Copilot OpenAI-Compatible Proxy

A production-ready HTTP proxy that exposes an **OpenAI-compatible API** backed by the [GitHub Copilot SDK](https://github.com/github/copilot-sdk).  
Point any OpenAI client (including `@ai-sdk/openai-compatible`) at this server and it will transparently call Copilot on your behalf.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Copilot CLI Authentication](#copilot-cli-authentication)
4. [Setup](#setup)
5. [Environment Variables](#environment-variables)
6. [Endpoints](#endpoints)
7. [Usage Example](#usage-example)
8. [Docker](#docker)
9. [Development](#development)
10. [Limitations](#limitations)

---

## Overview

```
External Client  ──(Bearer token)──▶  Proxy Server  ──(Copilot CLI)──▶  GitHub Copilot
```

- The proxy authenticates **external clients** with a shared `PROXY_API_KEY` (Bearer token).
- The proxy communicates with Copilot using the **Copilot CLI** that must be installed and authenticated on the server host – no credentials are ever forwarded from clients.
- Responses are converted to OpenAI-compatible JSON shapes so any standard OpenAI client works out of the box.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| npm | ≥ 8 | Package manager |
| Copilot CLI | latest | Backend – must be installed **separately** |

### Install the Copilot CLI

Follow the official guide:  
<https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli>

Verify the CLI is available:

```bash
copilot --version
```

---

## Copilot CLI Authentication

> **Important:** The proxy server uses the Copilot CLI's stored credentials.  
> No GitHub token is ever accepted from or forwarded to external clients.

1. Install the CLI (see above).
2. Authenticate:

   ```bash
   copilot auth login
   ```

3. Verify authentication:

   ```bash
   copilot --version
   ```

The SDK picks up stored credentials automatically when `useLoggedInUser` is `true` (the default).  
You can also authenticate via environment variables (`COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`) on the host where the proxy runs.

---

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/moyuanhua/copilot-openai-compatible.git
cd copilot-openai-compatible

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Configure environment
export PROXY_API_KEY="your-secret-key"   # required to secure the proxy
export PORT=3000                          # optional, default 3000

# 5. Start
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_API_KEY` | *(unset – insecure)* | Bearer token required by external clients. If unset, the proxy accepts all requests (development only). |
| `PORT` | `3000` | TCP port the server listens on. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in milliseconds. |
| `RATE_LIMIT_MAX` | `60` | Maximum requests per IP per window. |
| `COPILOT_LOG_LEVEL` | `warning` | Copilot CLI log level (`none` \| `error` \| `warning` \| `info` \| `debug` \| `all`). |

---

## Endpoints

### `POST /v1/chat/completions`

Accepts OpenAI-style chat completion requests.

**Request body:**

```json
{
  "model": "gpt-4.1",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user",   "content": "What is 2 + 2?" }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1024
}
```

**Non-streaming response** (`stream: false` or omitted):

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "gpt-4.1",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "4" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 20, "completion_tokens": 1, "total_tokens": 21 }
}
```

**Streaming response** (`stream: true`): Server-Sent Events (SSE), terminated with `data: [DONE]`.

---

### `GET /v1/models`

Returns available Copilot models in OpenAI-compatible format.

```json
{
  "object": "list",
  "data": [
    { "id": "gpt-4.1",  "object": "model", "created": 1700000000, "owned_by": "github-copilot" },
    { "id": "gpt-4o",   "object": "model", "created": 1700000000, "owned_by": "github-copilot" }
  ]
}
```

---

### `POST /v1/embeddings`

> ⚠️ **Not supported.** The GitHub Copilot SDK does not currently expose an embeddings API.  
> This endpoint returns HTTP 501 with a descriptive error.  
> It will be implemented once the SDK adds embedding support.

---

### `GET /health`

Health-check endpoint (no authentication required).

```json
{ "status": "ok" }
```

---

## Usage Example

Use `@ai-sdk/openai-compatible` to point any Vercel AI SDK application at this proxy:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

const copilotProxy = createOpenAICompatible({
  baseURL: 'http://localhost:3000/v1',
  name: 'copilot-proxy',
  apiKey: process.env.PROXY_API_KEY,  // your PROXY_API_KEY
});

const { text } = await generateText({
  model: copilotProxy.chatModel('gpt-4.1'),
  prompt: 'Explain async/await in TypeScript in one paragraph.',
});

console.log(text);
```

Or with the OpenAI SDK directly:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: process.env.PROXY_API_KEY,
});

const response = await client.chat.completions.create({
  model: 'gpt-4.1',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);
```

---

## Docker

### Quick start

```bash
# Build and run
PROXY_API_KEY=your-secret-key docker compose up --build
```

The container mounts your host's Copilot CLI config directories so the CLI can authenticate without re-logging in.  
Make sure you have already run `copilot auth login` on the **host** machine.

### Manual build

```bash
docker build -t copilot-proxy .
docker run -p 3000:3000 \
  -e PROXY_API_KEY=your-secret-key \
  -v "$HOME/.config/gh:/home/appuser/.config/gh:ro" \
  -v "$HOME/.config/copilot:/home/appuser/.config/copilot:ro" \
  copilot-proxy
```

---

## Development

```bash
# Install deps
npm install

# Run in watch mode (ts-node-dev)
npm run dev

# Lint
npm run lint

# Format
npm run format

# Tests
npm test

# Test coverage
npm run test:coverage
```

---

## Limitations

- **Embeddings not supported** – The Copilot SDK does not expose an embeddings API. `/v1/embeddings` returns HTTP 501.
- **Token usage is approximate** – The Copilot SDK does not expose exact token counts; the `usage` field in responses is estimated from character counts.
- **No function calling / tools forwarding** – Tool/function-calling parameters in OpenAI requests are currently ignored.
- **Single session per request** – A new Copilot session is created for every request and disconnected when the response is complete. Persistent multi-turn sessions are not yet supported.
- **Technical Preview** – The GitHub Copilot SDK is in technical preview and may change in breaking ways.
