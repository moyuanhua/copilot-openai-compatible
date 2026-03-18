import { Controller, Post, HttpCode, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('embeddings')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class EmbeddingsController {
  @Post()
  @HttpCode(501)
  create() {
    return {
      error: {
        message:
          'The /v1/embeddings endpoint is not supported by this proxy. The GitHub Copilot SDK does not currently provide an embeddings API.',
        type: 'not_implemented_error',
        code: 'embeddings_not_supported',
      },
    };
  }
}
