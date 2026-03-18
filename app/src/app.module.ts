import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatModule } from './chat/chat.module';
import { ModelsModule } from './models/models.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { CopilotModule } from './copilot/copilot.module';
import { HealthController } from './health/health.controller';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
    }]),
    CopilotModule,
    ChatModule,
    ModelsModule,
    EmbeddingsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
