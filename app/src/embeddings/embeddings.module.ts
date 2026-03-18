import { Module } from '@nestjs/common';
import { EmbeddingsController } from './embeddings.controller';

@Module({
  controllers: [EmbeddingsController],
})
export class EmbeddingsModule {}
