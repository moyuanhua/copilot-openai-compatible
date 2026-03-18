# Design Document — Copilot OpenAI-Compatible Proxy

## Overview

This service is a thin HTTP proxy that accepts OpenAI-style REST API requests and
translates them into calls to the GitHub Copilot SDK (`@github/copilot-sdk`).
Its goal is to let any tool or library that speaks OpenAI's API surface—including
`@ai-sdk/openai-compatible`—use GitHub Copilot as the backend LLM with zero or
minimal client changes.

---

## Architecture

```
Client (OpenAI SDK / @ai-sdk/openai-compatible / raw fetch)
  │
  │  HTTP  Bearer <PROXY_API_KEY>
  ▼
┌────────────────────────────────────────────────────────┐
│                   Express HTTP Server                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Middleware                                       │ │
│  │  • Logger (request/response, metrics)             │ │
│  │  • Rate Limiter (per-key, express-rate-limit)     │ │
│  │  • Auth (validate PROXY_API_KEY)                  │ │
│  └──────────────────────────────────────────────────┘ │
│  Routes                                                │
│  • POST /v1/chat/completions  → chat.ts               │
│  • POST /v1/embeddings        → embeddings.ts         │
│  • GET  /v1/models            → models.ts             │
│  • GET  /health               (no auth)               │
│  • GET  /metrics              (no auth)               │
└────────────────────────────────────────────────────────┘
  │
  │  @github/copilot-sdk  (JSON-RPC over stdio)
  ▼
┌────────────────────────────────────────────────────────┐
│   GitHub Copilot CLI (local process)                   │
│   • Authenticates with GitHub via stored OAuth token   │
│     or GITHUB_TOKEN environment variable               │
│   • Proxies model requests to GitHub Copilot API       │
└────────────────────────────────────────────────────────┘
```

---

## Copilot SDK Authentication

### How it works

The `@github/copilot-sdk` package is a TypeScript/Node wrapper that communicates
with the **GitHub Copilot CLI** (`@github/copilot`) over a JSON-RPC protocol
(stdio or TCP).  The CLI itself handles all network requests to GitHub's Copilot
API.

Authentication happens at the CLI level, not at the SDK level:

| Method | How |
|---|---|
| **Logged-in user** (default) | Copilot CLI reads the stored OAuth token written by `gh auth login` or `copilot auth login`. `CopilotClient` uses this automatically. |
| **GITHUB_TOKEN env var** | Set `GITHUB_TOKEN` (or `GH_TOKEN`) before starting the proxy. The SDK passes it to the CLI process via `CopilotClientOptions.githubToken`. |
| **Passthrough mode** | If `ENABLE_PASSTHROUGH=true`, clients may send their own GitHub token via `X-GitHub-Token` header. The proxy creates a `CopilotClient` with that token. |

### Security notes for passthrough mode

- Only enable passthrough mode when you trust every client that has a valid `PROXY_API_KEY`.
- Tokens supplied via `X-GitHub-Token` are passed directly to the Copilot CLI; they are never logged or returned in responses.
- GitHub tokens passed from clients must have `copilot` scope (or appropriate Copilot plan access).
- Passthrough tokens are used for a single request only — no caching.

---

## Mapping Decisions

### Chat Messages → Copilot Prompt

The Copilot SDK's `session.sendAndWait({ prompt })` accepts a **single string
prompt**.  The proxy converts an OpenAI `messages` array as follows:

1. **system** messages are concatenated and passed to `SessionConfig.systemMessage`
   in append mode (added after the SDK-managed system context).
2. **user / assistant** messages are formatted as `Role: content` pairs and
   joined with double newlines to form the `prompt` string.

This approach preserves conversation history in a single-turn way.  Each proxy
request creates a new Copilot session so conversation context does NOT persist
between separate API calls (stateless by design).

### Model ID mapping

Clients often use OpenAI model names (e.g. `gpt-4`). The proxy maintains a
mapping table (`src/types/models.ts`) that maps these to Copilot model IDs:

| Client model ID | Copilot model ID |
|---|---|
| `gpt-4` | `gpt-4.1` |
| `gpt-4-turbo` | `gpt-4.1` |
| `gpt-3.5-turbo` | `gpt-4.1-mini` |
| `claude-3-5-sonnet` | `claude-sonnet-4.5` |
| `gpt-4.1`, `gpt-4o`, etc. | (passed through unchanged) |

Unknown IDs are passed through to the Copilot CLI without mapping.
Custom mappings can be provided via `CUSTOM_MODEL_MAP` (JSON env var).

### Parameters not supported by Copilot SDK

The following OpenAI parameters are **accepted** (for compatibility) but
**ignored**:
- `temperature`
- `top_p`
- `stop`
- `n` (only `n=1` is ever honoured)

### Token counts

The Copilot SDK does not expose token counts. The proxy returns `-1` for all
`usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens`
fields in non-streaming responses.

### Embeddings

The Copilot SDK does not provide an embeddings API. The `/v1/embeddings`
endpoint returns a **structural stub** — a unit-normalized vector of dimension
1536 derived from the character codes of the input text.  This allows clients
that also call embeddings to start up without errors.  For production use, point
to a real embeddings service.

---

## Streaming Semantics

When `stream: true` is passed:

1. The proxy responds with `Content-Type: text/event-stream`.
2. A first SSE chunk is immediately sent with `delta.role = "assistant"` (mirrors OpenAI behaviour).
3. The Copilot session is created with `streaming: true`. The proxy subscribes to
   `assistant.message_delta` events and emits each `deltaContent` as an SSE chunk.
4. After `sendAndWait` resolves, a final chunk with `finish_reason: "stop"` is sent.
5. The stream is terminated with the `data: [DONE]` sentinel required by many
   OpenAI clients.
6. Errors encountered mid-stream are serialised as an SSE chunk with an `error`
   field (the connection is then closed).

---

## Observability

- All requests are logged at `INFO` level (or `WARN`/`ERROR` for ≥ 4xx/5xx).
  Logging can be silenced with `LOG_LEVEL=none`.
- A lightweight in-memory metrics object tracks `requestCount`, `errorCount`, and
  `totalLatencyMs`, exposed at `GET /metrics`.
- Metrics reset on process restart (no persistence).

---

## Rate Limiting

`express-rate-limit` is applied globally (before auth) and keys on the
`Authorization` header value (or IP address if absent).  Defaults: 60 req/min
per key, customisable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`.

---

## Limitations

1. **No real embeddings** — the embedding endpoint returns stub vectors.
2. **Token counts unavailable** — all `usage` fields are `-1`.
3. **Stateless sessions** — no conversation history across separate API calls.
4. **CLI dependency** — the Copilot CLI must be installed and authenticated on
   the host running the proxy.
5. **Single completion** — `n > 1` is silently treated as `n = 1`.
6. **No function-calling / tools** — OpenAI tool-call messages are not mapped.

---

## Future Work

- Session pooling / reuse for multi-turn conversations.
- Tool-call mapping (OpenAI `tools` → Copilot `defineTool`).
- Real embeddings forwarding to a configurable upstream.
- Metrics export (Prometheus / OpenTelemetry).
- Docker image publication to GHCR.
