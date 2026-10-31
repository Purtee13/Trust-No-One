import { generateGemma as generateOllama } from './gemma.js';
import { hostedGemma } from './cloud-deploy/lib/hosted-gemma.js';

export function createGenerator(env = process.env, { google = hostedGemma, ollama = generateOllama } = {}) {
  return async input => {
    const provider = env.GEMMA_PROVIDER || 'google';
    if (provider === 'google') {
      if (!env.GOOGLE_API_KEY?.trim()) {
        throw Object.assign(new Error('Add GOOGLE_API_KEY to .env and restart the backend, or explicitly set GEMMA_PROVIDER=ollama.'), { status: 503 });
      }
      return google(input, env);
    }
    if (provider === 'ollama') return ollama(input, {
      baseUrl: env.OLLAMA_URL || 'http://localhost:11434',
      model: env.GEMMA_MODEL || 'gemma4:e4b',
      timeout: Number(env.GEMMA_TIMEOUT_MS || 180000),
    });
    throw Object.assign(new Error('GEMMA_PROVIDER must be google or ollama'), { status: 503 });
  };
}
