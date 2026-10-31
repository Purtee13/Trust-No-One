import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator } from './backend-ai.js';

test('local backend defaults to Google and passes the server key without calling Ollama', async () => {
  const input = { task: 'shadow' };
  const env = { GOOGLE_API_KEY: 'test-only-key', GOOGLE_GEMMA_MODEL: 'configured-model' };
  const generate = createGenerator(env, {
    google: async (received, config) => { assert.equal(received, input); assert.equal(config, env); return { advice: 'Test tip' }; },
    ollama: () => assert.fail('Ollama must not run by default'),
  });
  assert.deepEqual(await generate(input), { advice: 'Test tip' });
});

test('missing key and provider errors do not silently switch providers', async () => {
  const adapters = { google: () => assert.fail('No request without a key'), ollama: () => assert.fail('No implicit fallback') };
  await assert.rejects(createGenerator({}, adapters)({}), { status: 503 });
  await assert.rejects(createGenerator({ GEMMA_PROVIDER: 'unknown' }, adapters)({}), /must be google or ollama/);
});

test('explicit Ollama selection works without a Google key', async () => {
  const generate = createGenerator({ GEMMA_PROVIDER: 'ollama', OLLAMA_URL: 'http://model.test', GEMMA_MODEL: 'custom', GEMMA_TIMEOUT_MS: '5000' }, {
    google: () => assert.fail('Google must not run'),
    ollama: async (_, options) => { assert.deepEqual(options, { baseUrl: 'http://model.test', model: 'custom', timeout: 5000 }); return { advice: 'Local tip' }; },
  });
  assert.deepEqual(await generate({}), { advice: 'Local tip' });
});
