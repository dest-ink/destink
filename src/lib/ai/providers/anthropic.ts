import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, AiCallOptions, AiCallResult } from './types';

export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async call(options: AiCallOptions): Promise<AiCallResult> {
    const { model, system, prompt, maxTokens = 4096 } = options;
    const client = this.getClient();

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

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
