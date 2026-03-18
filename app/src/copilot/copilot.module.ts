import { Module, Global } from '@nestjs/common';
import { CopilotService } from './copilot.service';

@Global()
@Module({
  providers: [CopilotService],
  exports: [CopilotService],
})
export class CopilotModule {}
