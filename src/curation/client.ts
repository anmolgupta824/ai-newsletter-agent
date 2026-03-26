import OpenAI from 'openai';

// Supported models via OpenRouter
export const CURATION_MODELS = [
  'openai/gpt-4o-mini',                // PRIMARY (reliable structured JSON, fast)
  'meta-llama/llama-3.1-8b-instruct',  // Fallback (cheap backup)
];

// Approximate cost per 1M tokens (for run cost estimation)
export const MODEL_COSTS = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'meta-llama/llama-3.1-8b-instruct': { input: 0.06, output: 0.06 },
};

let client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing OPENROUTER_API_KEY. ' +
      'Get a free key at https://openrouter.ai/keys'
    );
  }

  client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.SITE_URL ?? 'https://your-site.com',
      'X-Title': process.env.DIGEST_NAME ?? 'AI Digest Agent',
    },
  });

  return client;
}
