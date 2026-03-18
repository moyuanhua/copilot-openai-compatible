/**
 * Manual mock for @github/copilot-sdk used in tests.
 *
 * This mock avoids any dependency on the Copilot CLI so tests can run in CI
 * environments where the CLI is not installed.
 */

export type SessionEventHandler = (event: { type: string; data: Record<string, unknown> }) => void;

export class CopilotClient {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async createSession(_config?: Record<string, unknown>): Promise<MockCopilotSession> {
    return new MockCopilotSession();
  }
}

export class MockCopilotSession {
  private handlers: Map<string, SessionEventHandler[]> = new Map();

  on(eventTypeOrHandler: string | SessionEventHandler, handler?: SessionEventHandler): () => void {
    if (typeof eventTypeOrHandler === 'function') {
      const h = eventTypeOrHandler;
      const list = this.handlers.get('*') ?? [];
      list.push(h);
      this.handlers.set('*', list);
      return () => {};
    }
    const list = this.handlers.get(eventTypeOrHandler) ?? [];
    list.push(handler!);
    this.handlers.set(eventTypeOrHandler, list);
    return () => {};
  }

  emit(eventType: string, data: Record<string, unknown> = {}): void {
    const list = this.handlers.get(eventType) ?? [];
    const allList = this.handlers.get('*') ?? [];
    const event = { type: eventType, data };
    [...list, ...allList].forEach((h) => h(event));
  }

  async send(_options: { prompt: string }): Promise<string> {
    // Simulate async response
    setTimeout(() => {
      this.emit('assistant.message_delta', { deltaContent: 'Hello ' });
      this.emit('assistant.message_delta', { deltaContent: 'world!' });
      this.emit('session.idle', {});
    }, 0);
    return 'msg-id-1';
  }

  async sendAndWait(_options: { prompt: string }): Promise<{ data: { content: string } }> {
    return { data: { content: 'Mock response from Copilot.' } };
  }

  async disconnect(): Promise<void> {}
}
