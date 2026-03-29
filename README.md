# copilot-openai-compatible

An OpenAI-compatible HTTP API server that proxies requests to **GitHub Copilot** via the [`@github/copilot-sdk`](https://github.com/github/copilot-sdk). Any framework that only speaks the OpenAI chat-completions format (LangChain, LiteLLM, Open WebUI, etc.) can point at this server and use GitHub Copilot as its backend.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| GitHub Copilot CLI | installed and logged in via `gh copilot login` or `copilot-cli login` |

---

## Setup

```bash
# Install dependencies
npm install

# (Optional) Copy the example env file
cp .env.example .env

# Start in development mode (tsx watch, restarts on file change)
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `SESSION_TTL_MS` | `600000` | Idle session eviction time (ms) |

---

## API Endpoints

### `GET /health`
Returns `{ "status": "ok" }`.

### `GET /v1/models`
Returns all Copilot-available models in the OpenAI models-list format.

### `POST /v1/chat/completions`
Accepts a standard OpenAI `ChatCompletionRequest` body.

**Supported fields:**

| Field | Support |
|---|---|
| `model` | ✅ Mapped directly to Copilot session model |
| `messages` | ✅ system / user / assistant / tool roles |
| `stream` | ✅ SSE streaming |
| `tools` | ✅ Passed through as Copilot SDK tool definitions |
| `temperature`, `top_p`, `max_tokens` | ⚠️ Accepted but not forwarded (Copilot controls sampling) |

---

## Multi-turn Sessions

By default every request creates an **ephemeral** session that is disconnected after the response. To maintain a persistent conversation across multiple requests, pass the same `X-Session-Id` header:

```bash
# First turn
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: my-chat-1" \
  -d '{
    "model": "gpt-4.1",
  }'

# Second turn — session remembers Alice
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: my-chat-1" \
  -d '{
    "model": "gpt-4.1",
    "messages": [{"role": "user", "content": "What is my name?"}]
  }'
```

Sessions are automatically evicted after `SESSION_TTL_MS` ms of inactivity.

---

## Streaming Example

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "stream": true,
    "messages": [{"role": "user", "content": "Tell me a short story."}]
  }'
```

---

## Tool / Function Calling

Define tools using the standard OpenAI `tools` array. The server registers them in the Copilot session so the model is aware of them and can reason about their results when you provide `role:"tool"` messages in the conversation history.

```json
{
  "model": "gpt-4.1",
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get the current weather for a location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": { "type": "string", "description": "City, Country" }
        },
        "required": ["location"]
      }
    }
  }],
  "messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]
}
```

> **Note**: The Copilot SDK handles tool execution internally. Full round-trip function calling (model → `tool_calls` → client executes → `tool_results`) is not supported because the SDK does not pause mid-turn for external execution. Tool context from prior turns is injected in the system message.

---

## Available Models

The default model is `gpt-4.1`. Pass any `id` below in the `model` field of your request.

> **Premium requests**: On paid Copilot plans, `gpt-4.1` and `gpt-5-mini` are **included** (no premium requests consumed). All other models deduct from your monthly premium request allowance according to their multiplier. See [GitHub docs](https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests#model-multipliers) for the latest numbers.

### OpenAI

| Model ID | Status | Notes |
|---|---|---|
| `gpt-4.1` | GA | **Included model** — no premium requests on paid plans |
| `gpt-5-mini` | GA | **Included model** — no premium requests on paid plans |
| `gpt-5.1` | ⚠️ Retiring 2026-04-01 | 1× premium |
| `gpt-5.1-codex` | ⚠️ Retiring 2026-04-01 | 1× premium |
| `gpt-5.1-codex-max` | ⚠️ Retiring 2026-04-01 | Premium; agentic tasks |
| `gpt-5.1-codex-mini` | ⚠️ Retiring 2026-04-01 | 1× premium |
| `gpt-5.2` | GA | Premium; deep reasoning & debugging |
| `gpt-5.2-codex` | GA | Premium; agentic software development |
| `gpt-5.3-codex` | GA | Premium; agentic software development |
| `gpt-5.4` | GA | Premium; deep reasoning & debugging |
| `gpt-5.4-mini` | GA | Premium; agentic tasks — multiplier subject to change |

### Anthropic

| Model ID | Status | Notes |
|---|---|---|
| `claude-haiku-4.5` | GA | 1× premium; fast, lightweight tasks |
| `claude-sonnet-4` | GA | 1× premium; balanced coding workflows |
| `claude-sonnet-4.5` | GA | 1× premium; general-purpose & agentic |
| `claude-sonnet-4.6` | GA | 1× premium; enhanced reasoning — multiplier subject to change |
| `claude-opus-4.5` | GA | 3× premium; complex reasoning |
| `claude-opus-4.6` | GA | 3× premium; complex reasoning |
| `claude-opus-4.6-fast` | Public preview | Premium; fast-mode variant of Opus 4.6 |

### Google

| Model ID | Status | Notes |
|---|---|---|
| `gemini-2.5-pro` | GA | Premium; complex code gen & debugging |
| `gemini-3-flash` | Public preview | Premium; fast, lightweight tasks |
| `gemini-3.1-pro` | Public preview | Premium; deep reasoning, long context |

### xAI

| Model ID | Status | Notes |
|---|---|---|
| `grok-code-fast-1` | GA | Premium; fast code completions |

### Fine-tuned (GitHub Copilot)

| Model ID | Base model | Status | Notes |
|---|---|---|---|
| `raptor-mini` | GPT-5 mini | Public preview | Fast inline suggestions |
| `goldeneye` | GPT-5.1-Codex | Public preview | Complex reasoning |

---

## Build

```bash
npm run build   # emits to dist/
npm start       # runs dist/server.js on PORT (default 3000)
```

---

## PM2 Deployment

The recommended way to run this server in production is with [PM2](https://pm2.keymetrics.io/).

### Install PM2

```bash
npm install -g pm2
```

### Start (production — port 8888)

```bash
npm run build        # compile TypeScript first
pm2 start ecosystem.config.cjs
```

### Start in development mode (port 3000)

```bash
pm2 start ecosystem.config.cjs --env development
```

### Common PM2 commands

```bash
pm2 list                   # show running apps
pm2 logs copilot-api       # tail logs
pm2 restart copilot-api    # restart
pm2 stop copilot-api       # stop
pm2 delete copilot-api     # remove from PM2
```

### Auto-start on system boot

```bash
pm2 startup                # follow the printed instruction to install init script
pm2 save                   # persist current process list
```

### Health check

```bash
curl http://localhost:8888/health
# {"status":"ok","timestamp":"..."}
```
