import type { AiProvider, AiCallOptions, AiCallResult } from './types';

/**
 * Anthropic provider — uses the @anthropic-ai/sdk package.
 * The SDK is dynamically imported on first call to avoid loading it
 * when the provider isn't configured.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private client: unknown = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private async getClient(): Promise<{ messages: { create: (opts: unknown) => Promise<unknown> } }> {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client as { messages: { create: (opts: unknown) => Promise<unknown> } };
  }

  async call(options: AiCallOptions): Promise<AiCallResult> {
    const { model, system, prompt, maxTokens = 4096 } = options;

    if (!this.isConfigured()) {
      throw new Error('Anthropic API key is not configured. Set ANTHROPIC_API_KEY in your environment.');
    }

    const client = await this.getClient();

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error(`Unexpected Anthropic response type: ${content.type}`);
    }

    return {
      text: content.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model,
    };
  }
}
