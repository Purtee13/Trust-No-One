import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedGemma } from './cloud-deploy/lib/hosted-gemma.js';
import { generateGemma as ollama } from './gemma.js';
import { SECURITY_IMAGE } from './cloud-deploy/lib/evidence-image.js';
const context = { players: [{ id: 'p1', evidence: { kind: 'image', imageUrl: '/evidence/pod-b.png', text: 'Review the camera image.' } }] };
const answer = { suspect: 'p1', interrogate: 'p1', confidence: 30, reason: 'Camera evidence.', question: 'Explain the cables.' };

test('Google receives the actual PNG bytes with the clue holder for Oracle analysis and voting', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => {
    assert.match(url, /generativelanguage.googleapis.com/);
    const parts = JSON.parse(options.body).contents[0].parts;
    const image = parts.find(p => p.inlineData)?.inlineData;
    assert.equal(image.mimeType, 'image/png');
    assert.equal(image.data, SECURITY_IMAGE.data);
    assert.deepEqual([...Buffer.from(image.data, 'base64').subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.ok(parts.some(p => p.text?.includes('held by player p1')));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] });
  };
  for (const task of ['oracle', 'oracle-vote']) {
    await hostedGemma({ task, context, playerIds: ['p1'] }, { GOOGLE_API_KEY: 'test-key' });
  }
});

test('Ollama receives image pixels, including legacy SVG clues', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_, options) => {
    const message = JSON.parse(options.body).messages.find(m => m.role === 'user');
    assert.deepEqual(message.images, [SECURITY_IMAGE.data]);
    assert.equal(JSON.parse(message.content).attachedImages[0].playerId, 'p1');
    return Response.json({ message: { content: JSON.stringify(answer) } });
  };
  const legacy = structuredClone(context);
  legacy.players[0].evidence.imageUrl = '/evidence/pod-b.svg';
  await ollama({ task: 'oracle', context: legacy, playerIds: ['p1'] });
});

test('unrecognized evidence images fail instead of pretending they were inspected', async () => {
  const unknown = structuredClone(context);
  unknown.players[0].evidence.imageUrl = 'https://unknown.test/image.png';
  await assert.rejects(hostedGemma({ task: 'oracle', context: unknown, playerIds: ['p1'] }, { GOOGLE_API_KEY: 'test-key' }), { status: 422 });
});
