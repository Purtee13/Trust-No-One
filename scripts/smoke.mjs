import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://localhost:3000';
async function call(path, body, token) {
  const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(200000) });
  const data = await res.json();
  assert.equal(res.ok, true, JSON.stringify(data)); return data;
}
assert.equal((await fetch(base)).status, 200);
const host = await call('/api/rooms', { name: 'Smoke host' });
const root = `/api/rooms/${host.room.code}`;
const players = [host];
for (const name of ['Alex', 'Sam', 'Maya']) players.push(await call(`${root}/join`, { name }));
const control = (action, body = {}) => call(`${root}/${action}`, body, host.hostToken);
for (const p of players) await call(`${root}/ready`, { ready: true }, p.playerToken);
await control('start');
const rooms = await Promise.all(players.map(p => call(root, undefined, p.playerToken)));
assert.equal(rooms.filter(r => r.me.role === 'saboteur').length, 1);
const image = rooms.find(r => r.me.evidence.imageUrl).me.evidence.imageUrl;
assert.match((await fetch(base + image)).headers.get('content-type'), /image/);
for (const p of players) await call(`${root}/ready`, { ready: true }, p.playerToken);
await control('advance');
for (const p of players) await call(`${root}/answer`, { answer: 'Pod D has all systems online. Pod B has hull damage.' }, p.playerToken);
console.log('Four real sessions joined through frontend proxy. Asking Gemma…');
await control('generate-oracle');
await control('generate-shadow');
await control('advance');
const state = await call(root, undefined, host.playerToken);
const target = players.find(p => p.playerId === state.oracle.interrogate);
await call(`${root}/response`, { response: 'My evidence says D has power, oxygen and navigation online.' }, target.playerToken);
await control('advance');
for (const p of players) await call(`${root}/vote`, { pod: 'D', suspect: state.oracle.suspect }, p.playerToken);
await control('generate-oracle-vote');
await control('advance');
const final = await call(root, undefined, host.playerToken);
assert.equal(final.status, 'result');
assert.equal(final.result.survived, true);
console.log(`PASS: room ${host.room.code} completed all phases with live Gemma, private evidence and final reveal.`);
