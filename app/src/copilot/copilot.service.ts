import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { CopilotClient } from '@github/copilot-sdk';

export const STATIC_MODELS = ['gpt-5-mini', 'claude-sonnet-4.5', 'claude-haiku-4.5'];

@Injectable()
export class CopilotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopilotService.name);
  private client: CopilotClient | null = null;

  async onModuleInit() {
    this.client = new CopilotClient({
      logLevel: (process.env.COPILOT_LOG_LEVEL as any) ?? 'warning',
    });
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
