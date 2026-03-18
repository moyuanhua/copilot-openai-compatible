import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { CopilotClient } from '@github/copilot-sdk';
import type { CopilotClientOptions } from '@github/copilot-sdk';

export const STATIC_MODELS = ['gpt-5-mini', 'claude-sonnet-4.5', 'claude-haiku-4.5'];

type LogLevel = NonNullable<CopilotClientOptions['logLevel']>;
const VALID_LOG_LEVELS: LogLevel[] = ['none', 'error', 'warning', 'info', 'debug', 'all'];

@Injectable()
export class CopilotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopilotService.name);
  private client: CopilotClient | null = null;

  async onModuleInit() {
    const raw = process.env.COPILOT_LOG_LEVEL ?? 'warning';
    const logLevel: LogLevel = (VALID_LOG_LEVELS as string[]).includes(raw)
      ? (raw as LogLevel)
      : 'warning';
    this.client = new CopilotClient({ logLevel });
    await this.client.start();
    this.logger.log('Copilot client started');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      this.logger.log('Copilot client stopped');
    }
  }

  getClient(): CopilotClient {
    if (!this.client) {
      throw new Error('Copilot client not initialized');
    }
    return this.client;
  }
}
