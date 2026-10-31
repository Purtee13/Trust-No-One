import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from './server.js';

test('four players complete a game with private roles, locked votes and guarded phases', async t => {
  const requests = [];
  const server = createGameServer({ generate: async input => {
    requests.push(input);
    if (input.task === 'shadow') return { advice: 'Question the report.' };
    if (input.task === 'oracle-vote') return { suspect: input.playerIds[0], reason: 'Final assessment.' };
    return { suspect: input.playerIds[0], interrogate: input.playerIds[0], confidence: 81, reason: 'Conflicting evidence', question: 'Explain your choice.' };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body, auth, expected = 200) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  const first = await call('/api/rooms', { name: 'Alex' }, null, 201);
  const root = `/api/rooms/${first.room.code}`;
  const players = [first];
  for (const name of ['Sam', 'Maya', 'Lee']) players.push(await call(`${root}/join`, { name }, null, 201));
  await call(`${root}/join`, { name: 'Extra' }, null, 409);
  await call(root, undefined, null, 401);
  await call(`${root}/start`, {}, first.playerToken, 403);
  const host = first.hostToken;
  await call(`${root}/start`, {}, host, 409);
  await call(`${root}/ready`, { ready: true }, host, 403);
  await call(`${root}/ready`, { ready: 'yes' }, first.playerToken, 400);
  for (const p of players) await call(`${root}/ready`, { ready: true }, p.playerToken);
  assert.equal((await call(root, undefined, first.playerToken)).players.filter(p => p.ready).length, 4);
  await call(`${root}/ready`, { ready: false }, first.playerToken);
  await call(`${root}/start`, {}, host, 409);
  await call(`${root}/ready`, { ready: true }, first.playerToken);
  await call(`${root}/start`, {}, host);
  const views = await Promise.all(players.map(p => call(root, undefined, p.playerToken)));
  const saboteur = views.find(v => v.me.role === 'saboteur').me.id;
  assert.equal(views.filter(v => v.me.role === 'saboteur').length, 1);
  for (const view of views) {
    assert.equal(view.saboteurId, undefined);
    assert.equal(view.players.some(p => 'role' in p || 'token' in p || 'evidence' in p), false);
    assert.equal(view.result, undefined);
  }
  assert.equal(views.every(v => v.players.every(p => !p.ready)), true);
  await call(`${root}/advance`, {}, host, 409);
  for (const p of players) await call(`${root}/ready`, { ready: true }, p.playerToken);
  await call(`${root}/advance`, {}, host);
  await call(`${root}/ready`, { ready: false }, first.playerToken, 409);
  await call(`${root}/advance`, {}, host, 409);
  await call(`${root}/generate-oracle`, {}, host, 409);
  for (const p of players) await call(`${root}/answer`, { answer: 'D looks safe' }, p.playerToken);
  await call(`${root}/generate-oracle`, {}, first.playerToken, 403);
  await call(`${root}/generate-oracle`, {}, host);
  assert.equal(requests[0].context.saboteurId, undefined);
  assert.equal(requests[0].context.players.some(p => 'role' in p || 'token' in p), false);
  await call(`${root}/generate-shadow`, {}, host);
  assert.equal(requests[1].context.saboteurId, saboteur);
  await call(`${root}/answer`, { answer: 'overwrite' }, first.playerToken, 409);
  await call(`${root}/oracle`, { suspect: saboteur, interrogate: first.playerId, confidence: 81,
    reason: 'Conflicting evidence', question: 'Explain your choice.' }, host);
  await call(`${root}/shadow`, { advice: 'Question the report.' }, host);
  for (const p of players) {
    const view = await call(root, undefined, p.playerToken);
    assert.equal(view.me.shadowAdvice, p.playerId === saboteur ? 'Question the report.' : null);
  }
  const context = await call(`${root}/context`, undefined, host);
  assert.equal(context.saboteurId, undefined);
  await call(`${root}/context`, undefined, first.playerToken, 403);
  await call(`${root}/advance`, {}, host);
  await call(`${root}/response`, { response: 'All systems online.' }, players[1].playerToken, 403);
  await call(`${root}/response`, { response: 'All systems online.' }, first.playerToken);
  await call(`${root}/advance`, {}, host);
  for (const p of players) await call(`${root}/vote`, { pod: 'D', suspect: saboteur }, p.playerToken);
  await call(`${root}/vote`, { pod: 'B', suspect: saboteur }, first.playerToken, 409);
  assert.equal((await call(root, undefined, first.playerToken)).players.some(p => 'vote' in p), false);
  await call(`${root}/advance`, {}, host, 409);
  await call(`${root}/generate-oracle-vote`, {}, host);
  await call(`${root}/oracle-vote`, { suspect: saboteur, reason: 'Evidence conflict' }, host);
  await call(`${root}/advance`, {}, host);
  const final = await call(root, undefined, first.playerToken);
  assert.equal(final.result.survived, true);
  assert.equal(final.result.humansCorrect, true);
  assert.equal(final.result.oracleCorrect, true);
});
