import type { AiProvider, AiCallOptions, AiCallResult } from './types';

/**
 * OpenRouter provider — routes to 200+ models via OpenAI-compatible API.
 * Supports: OpenAI, Google, Meta, Mistral, Anthropic (via OR), and more.
 *
 * Set OPENROUTER_API_KEY in your environment to enable.
 * Models should be prefixed with provider in models.ts (e.g., 'openai/gpt-4o').
 */
export class OpenRouterProvider implements AiProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  async call(options: AiCallOptions): Promise<AiCallResult> {
    const { model, system, prompt, maxTokens = 4096 } = options;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3021',
        'X-Title': 'Destink',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const text = data.choices?.[0]?.message?.content ?? '';

    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model ?? model,
    };
  }
}
