import { Injectable, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { approveAll } from '@github/copilot-sdk';
import type { SessionConfig } from '@github/copilot-sdk';
import { CopilotService } from '../copilot/copilot.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService {
  constructor(private readonly copilotService: CopilotService) {}

  async createCompletion(dto: ChatCompletionDto, res: Response): Promise<void> {
    const { model, messages, stream = false } = dto;

    if (!messages || messages.length === 0) {
      throw new BadRequestException({
        error: {
          message: 'messages is required and must not be empty',
          type: 'invalid_request_error',
          code: 'invalid_messages',
        },
      });
    }

    const client = this.copilotService.getClient();
    const id = `chatcmpl-${uuidv4()}`;
    const created = Math.floor(Date.now() / 1000);

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Build prompt
    const prompt = nonSystemMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const sessionConfig: SessionConfig = { onPermissionRequest: approveAll };
    if (systemMessage) {
      sessionConfig.systemMessage = { content: systemMessage };
    }

    const session = await client.createSession(sessionConfig);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // First chunk with role
      const firstChunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      };
      res.write(`data: ${JSON.stringify(firstChunk)}\n\n`);

      await new Promise<void>((resolve, reject) => {
        session.on('assistant.message_delta', (event: { data: { deltaContent?: string } }) => {
          const chunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{ index: 0, delta: { content: event.data.deltaContent ?? '' }, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        session.on('session.idle', () => {
          const doneChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          };
          res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          resolve();
        });

        session.on('session.error', (event: { data: Record<string, unknown> }) => reject(event));

        session.send({ prompt }).catch(reject);
      });
    } else {
      const response = await session.sendAndWait({ prompt });
      const content = response?.data?.content ?? '';
      // Approximate token count using ~4 characters per token
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(content.length / 4);

      res.json({
        id,
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
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      });
    }

    if (session.disconnect) await session.disconnect();
  }
}
