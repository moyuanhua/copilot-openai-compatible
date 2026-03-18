# Design Notes

This document explains the key design decisions behind the Copilot OpenAI-Compatible Proxy.

---

## 1. Architecture Overview

```
External Client
    │ Authorization: Bearer <PROXY_API_KEY>
    ▼
┌─────────────────────────────────────┐
│        Express HTTP Server          │
│  ┌─────────┐  ┌──────┐  ┌───────┐  │
│  │  Logger │  │ Rate │  │ Auth  │  │
│  │Middleware│ │Limit │  │ MW    │  │
│  └─────────┘  └──────┘  └───────┘  │
│  ┌──────────────────────────────┐   │
│  │      Route Handlers          │   │
│  │  /v1/chat/completions        │   │
│  │  /v1/models                  │   │
│  │  /v1/embeddings (stub)       │   │
│  └──────────────────────────────┘   │
└───────────────┬─────────────────────┘
                │ @github/copilot-sdk
                ▼
        ┌──────────────┐
        │  Copilot CLI │  (JSON-RPC, spawned by SDK)
        └──────┬───────┘
               │ HTTPS / OAuth
               ▼
        GitHub Copilot API
```

---

## 2. Authentication Model

### External Client → Proxy

External clients authenticate using a **shared Bearer token** (`PROXY_API_KEY`).  
This is a simple but effective mechanism for a self-hosted proxy.

- The key is supplied in the `Authorization: Bearer <key>` header.
- The key is set via the `PROXY_API_KEY` environment variable on the server.
- If `PROXY_API_KEY` is unset, all requests are accepted (intended for local development only – a warning is logged at startup).
- The key is never logged, never forwarded to Copilot, and never visible in responses.

### Proxy → GitHub Copilot

The proxy uses the **Copilot CLI's stored credentials** via `useLoggedInUser: true` (the SDK default).  
The CLI handles the OAuth flow; the SDK speaks JSON-RPC to the CLI process it spawns.

Supported auth methods (all handled transparently by the SDK/CLI):
- Stored OAuth credentials from `copilot auth login`
- `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` environment variables

No GitHub tokens are ever accepted from or forwarded to external clients.

---

## 3. Mapping Decisions

### Messages → Prompt

The Copilot SDK accepts a single `prompt` string per `session.send()` call.  
OpenAI clients send an array of `{ role, content }` messages.

**Mapping:**
2. The **first `system` message** (if any) is extracted and passed as `sessionConfig.systemMessage.content` – the SDK injects it into the model's system prompt.
3. All remaining messages (non-system) are serialised as `ROLE: content` lines joined by double newlines.

If multiple `system` messages are present, only the **first** is forwarded to the SDK's `systemMessage` option; the rest are dropped, as the SDK accepts a single system prompt. Clients should consolidate system instructions into one message.

This preserves conversational context in a way the model can understand.

### Model ID

The `model` field in the request is passed directly to `createSession({ model })`.  
Available model IDs are exposed via `GET /v1/models`.

### Parameters

| OpenAI param | Copilot SDK mapping |
|---|---|
| `model` | `SessionConfig.model` |
| `stream` | `SessionConfig.streaming` |
| `temperature` | Not forwarded (SDK does not expose this) |
| `max_tokens` | Not forwarded (SDK does not expose this) |
| `top_p` | Not forwarded |
| `stop` | Not forwarded |
| `n` | Not forwarded (always 1 choice) |

Parameters that cannot be forwarded are silently ignored to maintain compatibility.

### Token Usage

The Copilot SDK does not expose token counts.  
The `usage` field in non-streaming responses is estimated using the heuristic `characters / 4 ≈ tokens`.

---

## 4. Streaming Design

When `stream: true`:

1. Response headers are set to `Content-Type: text/event-stream` (SSE).
2. A new Copilot session is created with `streaming: true`.
3. `session.on("assistant.message_delta")` is subscribed – each delta is serialised to a `chat.completion.chunk` SSE event.
4. `session.on("session.idle")` is subscribed – when fired, a final chunk with `finish_reason: "stop"` is written, followed by `data: [DONE]`, then the HTTP connection is closed.
5. If an error occurs after headers have been flushed, an error event is written and the connection is closed.

This matches the OpenAI streaming protocol exactly, allowing standard SSE-aware clients to consume the stream.

---

## 5. Session Lifecycle

Each HTTP request creates a **new Copilot session** and disconnects it when the response is complete.  
This is the safest model for a proxy:

- No cross-request state leakage.
- No idle session accumulation.
- Compatible with stateless HTTP clients.

Multi-turn (persistent) sessions are a potential future enhancement once the proxy can associate a session ID with a client connection.

---

## 6. Error Handling

| Scenario | HTTP status | OpenAI error shape |
|---|---|---|
| Missing/invalid auth token | 401 | `authentication_error` |
| Missing `messages` field | 400 | `invalid_request_error` |
| Copilot CLI not available | 500 | `server_error` |
| Stream error after headers sent | — | SSE error event, connection closed |
| Embeddings requested | 501 | `not_implemented_error` |
| Unknown endpoint | 404 | `not_found_error` |

---

## 7. Rate Limiting

Per-IP rate limiting is applied at the proxy level using `express-rate-limit`.  
Defaults: 60 requests per minute.  
Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.

Rate limiting is disabled in the `test` environment to avoid flaky tests.

---

## 8. Embeddings

The GitHub Copilot SDK does not provide an embeddings API.  
`POST /v1/embeddings` returns HTTP 501 with a descriptive error.  
This endpoint will be implemented once the SDK adds embedding support.

---

## 9. Security Considerations

- `PROXY_API_KEY` is never logged or returned in responses.
- GitHub credentials are never accepted from clients.
- Request bodies are not logged.
- The Docker image runs as a non-root user.
- The Copilot CLI config directories are mounted read-only in the Docker compose setup.
