import { Controller, Post, Body, Res, UseGuards, UseInterceptors, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('chat')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('completions')
  @HttpCode(200)
  async createCompletion(@Body() dto: ChatCompletionDto, @Res() res: Response): Promise<void> {
    await this.chatService.createCompletion(dto, res);
  }
}
