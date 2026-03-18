import { Injectable } from '@nestjs/common';
import { CopilotService, STATIC_MODELS } from '../copilot/copilot.service';

@Injectable()
export class ModelsService {
  constructor(private readonly copilotService: CopilotService) {}

  async listModels() {
    let modelIds: string[] = STATIC_MODELS;

    try {
      const client = this.copilotService.getClient();
      if ('listModels' in client && typeof client.listModels === 'function') {
        const models = await client.listModels();
        modelIds = models.map((m) => m.id);
      }
    } catch {
      // Fall back to static list
    }

    const created = Math.floor(Date.now() / 1000);
    return {
      object: 'list',
      data: modelIds.map((id) => ({
        id,
        object: 'model',
        created,
        owned_by: 'github-copilot',
      })),
    };
  }
}
