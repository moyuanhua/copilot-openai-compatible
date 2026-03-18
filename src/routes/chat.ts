/**
 * POST /v1/chat/completions
 *
 * Accepts OpenAI-style chat completion requests and proxies them through the
 * GitHub Copilot SDK.  Supports both streaming (SSE) and non-streaming modes.
 *
 * Authentication to Copilot is handled server-side via the Copilot CLI;
 * no token is ever forwarded from the caller.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { approveAll } from '@github/copilot-sdk';
import type { SessionConfig } from '@github/copilot-sdk';
import { getCopilotClient } from '../copilot/client';
import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from '../types';

const router = Router();

/**
 * Build the prompt string sent to the Copilot SDK from an array of OpenAI
 * chat messages.  The SDK accepts a single `prompt` string, so we encode
 * roles explicitly so the model has full context.
 */
function buildPrompt(messages: ChatCompletionRequest['messages']): string {
  return messages
    .map((m) => {
      const role = m.role.toUpperCase();
      return `${role}: ${m.content}`;
    })
    .join('\n\n');
}

/**
 * Extract a system message from the messages array (if present).
 * The Copilot SDK accepts an optional `systemMessage` config; we pass the
 * *first* system message there and strip it from the prompt.
 */
function extractSystem(messages: ChatCompletionRequest['messages']): {
  systemContent: string | null;
  rest: ChatCompletionRequest['messages'];
} {
  const systemIdx = messages.findIndex((m) => m.role === 'system');
  if (systemIdx === -1) return { systemContent: null, rest: messages };
  const systemContent = messages[systemIdx].content;
  const rest = messages.filter((_, i) => i !== systemIdx);
  return { systemContent, rest };
}

// ── POST /v1/chat/completions ─────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const body = req.body as ChatCompletionRequest;

  // Basic validation
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({
      error: {
        message: '`messages` must be a non-empty array.',
        type: 'invalid_request_error',
        code: 'missing_required_param',
      },
    });
    return;
  }

  const model = body.model || 'gpt-5-mini';
  const isStream = body.stream === true;
  const completionId = `chatcmpl-${uuidv4()}`;
  const created = Math.floor(Date.now() / 1000);

  const { systemContent, rest } = extractSystem(body.messages);
  const prompt = buildPrompt(rest);

  try {
    const client = await getCopilotClient();

    // Session config
    const sessionConfig: SessionConfig = {
      model,
      streaming: isStream,
      onPermissionRequest: approveAll,
    };
    if (systemContent) {
      sessionConfig.systemMessage = { content: systemContent };
    }

    const session = await client.createSession(sessionConfig);

    if (isStream) {
      // ── Streaming response (SSE) ────────────────────────────────────────
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();

      // Helper: write a single SSE event
      const writeChunk = (delta: string, finishReason: string | null = null) => {
        const chunk: ChatCompletionChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: finishReason ? {} : { role: 'assistant', content: delta },
              finish_reason: finishReason as ChatCompletionChunk['choices'][0]['finish_reason'],
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };

      await new Promise<void>((resolve, reject) => {
        session.on('assistant.message_delta', (event) => {
          writeChunk(event.data.deltaContent ?? '');
        });

        session.on('session.idle', () => {
          // Send finish chunk then [DONE]
          writeChunk('', 'stop');
          res.write('data: [DONE]\n\n');
          resolve();
        });

        session.send({ prompt }).catch(reject);
      });

      res.end();
      await session.disconnect();
    } else {
      // ── Non-streaming response ──────────────────────────────────────────
      const result = await session.sendAndWait({ prompt });
      const content = result?.data?.content ?? '';

      const response: ChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion',
        created,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
        usage: {
          // Approximate token counts (Copilot SDK does not expose token usage)
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: Math.ceil(content.length / 4),
          total_tokens: Math.ceil((prompt.length + content.length) / 4),
        },
      };

      res.json(response);
      await session.disconnect();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chat/completions] Error:', message);

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: 'An error occurred while communicating with the Copilot backend.',
          type: 'server_error',
          code: 'internal_error',
        },
      });
    } else {
      // Streaming already started – write an error event and close
      res.write(
        `data: ${JSON.stringify({ error: { message: 'Stream error', type: 'server_error' } })}\n\n`
      );
      res.end();
    }
  }
});

export default router;
