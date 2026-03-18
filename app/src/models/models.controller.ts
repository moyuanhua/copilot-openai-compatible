import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ModelsService } from './models.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('models')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  listModels() {
    return this.modelsService.listModels();
  }
}
