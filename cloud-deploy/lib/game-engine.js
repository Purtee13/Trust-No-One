import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const phases = ['lobby', 'evidence', 'discussion', 'interrogation', 'voting', 'result'];
const pods = ['A', 'B', 'C', 'D'];
const token = () => randomBytes(24).toString('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const requiredText = (value, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, `Text must contain 1–${max} characters`);
  return value.trim();
};

export function createGameHandler({ allowedOrigin = '*', generate, rooms = new Map() } = {}) {
  const listeners = new Map();
  const playerView = (room, player) => ({
    code: room.code, status: room.status, hostId: room.hostId,
    players: room.players.map(p => ({ id: p.id, name: p.name,
      answered: Boolean(p.answer), voted: Boolean(p.vote), ready: Boolean(p.ready),
      ...(p.answer ? { answer: p.answer } : {}),
      ...(p.response ? { response: p.response } : {}) })),
    question: 'Which pod do you believe is safest? Explain why.',
    oracle: room.oracle ? { suspect: room.oracle.suspect, confidence: room.oracle.confidence,
      reason: room.oracle.reason, interrogate: room.oracle.interrogate, question: room.oracle.question } : null,
    me: { id: player.id, name: player.name, role: player.role ?? null, evidence: player.evidence ?? null,
      objective: player.role === 'saboteur' ? 'Convince the crew to choose Pod B. Avoid detection.' : null,
      shadowAdvice: player.role === 'saboteur' ? room.shadowAdvice ?? null : null,
      vote: player.vote ?? null },
    ...(room.status === 'result' ? { result: result(room) } : {})
  });
  function result(room) {
    const tally = key => {
      const counts = {};
      for (const p of room.players) counts[p.vote[key]] = (counts[p.vote[key]] || 0) + 1;
      const high = Math.max(...Object.values(counts));
      return Object.keys(counts).filter(k => counts[k] === high).sort();
    };
    const chosenPods = tally('pod');
    const suspects = tally('suspect');
    return { correctPod: 'D', saboteurId: room.saboteurId, chosenPods, suspects,
      tiedPodVote: chosenPods.length > 1, tiedSuspectVote: suspects.length > 1,
      survived: chosenPods.length === 1 && chosenPods[0] === 'D',
      humansCorrect: suspects.length === 1 && suspects[0] === room.saboteurId,
      oracleVote: room.oracleVote, oracleCorrect: room.oracleVote.suspect === room.saboteurId };
  }
  function publish(room) {
    room.updatedAt = Date.now();
    for (const entry of listeners.get(room.code) || []) {
      entry.res.write(`data: ${JSON.stringify(playerView(room, entry.player))}\n\n`);
    }
  }
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/evidence/pod-b.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#101826"/><text x="35" y="50" fill="white" font-size="26">STATION SECURITY CAMERA — POD B</text><rect x="250" y="90" width="300" height="290" rx="75" fill="#64748b"/><circle cx="400" cy="190" r="55" fill="#0ea5e9"/><path d="M490 230 l-65 30 50 25 -80 35 40 35" fill="none" stroke="#ef4444" stroke-width="14"/><text x="35" y="420" fill="#fca5a5" font-size="24">HULL BREACH DETECTED / DO NOT LAUNCH</text></svg>');
      }
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true });
      let body = {};
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) fail(413, 'Body too large'); }
        try { body = JSON.parse(raw || '{}'); } catch { fail(400, 'Invalid JSON'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Expected JSON object');
      }
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        const name = requiredText(body.name, 40);
        if (rooms.size >= 1000) fail(503, 'Room capacity reached; restart demo server to clear rooms');
        let code;
        do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
        const player = { id: randomBytes(8).toString('hex'), name, token: token() };
        const room = { code, status: 'lobby', hostId: player.id, hostToken: token(), players: [player], updatedAt: Date.now() };
        rooms.set(code, room);
        return send(201, { playerId: player.id, playerToken: player.token, hostToken: room.hostToken, room: playerView(room, player) });
      }
      const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})(?:\/([a-z-]+))?$/);
      if (!match) fail(404, 'Route not found');
      const room = rooms.get(match[1].toUpperCase());
      if (!room) fail(404, 'Room not found');
      const action = match[2];
      if (req.method === 'POST' && action === 'join') {
        if (room.status !== 'lobby') fail(409, 'Game already started');
        if (room.players.length >= 4) fail(409, 'Room is full');
        const name = requiredText(body.name, 40);
        const player = { id: randomBytes(8).toString('hex'), name, token: token() };
        room.players.push(player); publish(room);
        return send(201, { playerId: player.id, playerToken: player.token, room: playerView(room, player) });
      }
      const bearer = req.headers.authorization?.replace(/^Bearer /, '');
      const host = equal(bearer, room.hostToken);
      const player = room.players.find(p => equal(bearer, p.token));
      if (!player && !host) fail(401, 'Valid bearer token required');
      if (req.method === 'GET' && !action) {
        if (!player) fail(403, 'Player token required');
        return send(200, playerView(room, player));
      }
      if (req.method === 'GET' && action === 'events') {
        if (!player) fail(403, 'Player token required');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        const entry = { res, player };
        if (!listeners.has(room.code)) listeners.set(room.code, new Set());
        listeners.get(room.code).add(entry);
        res.write(`data: ${JSON.stringify(playerView(room, player))}\n\n`);
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
        res.on('close', () => { clearInterval(heartbeat); listeners.get(room.code)?.delete(entry); });
        return;
      }
      if (req.method === 'GET' && action === 'context') {
        if (!host) fail(403, 'Host token required');
        return send(200, { code: room.code, status: room.status,
          scenario: { title: 'Escape Station', question: 'Which escape pod is safe?' },
          evidence: room.players.map(p => ({ playerId: p.id, evidence: p.evidence })),
          statements: room.players.map(p => ({ playerId: p.id, name: p.name, answer: p.answer ?? null, response: p.response ?? null })),
          oracle: room.oracle ?? null });
      }
      if (req.method !== 'POST') fail(404, 'Route not found');
      if (action?.startsWith('generate-')) {
        if (!host) fail(403, 'Host token required');
        const task = action.slice('generate-'.length);
        if (!['oracle', 'oracle-vote', 'shadow'].includes(task)) fail(404, 'Route not found');
        if (task === 'oracle' && (room.status !== 'discussion' || !room.players.every(p => p.answer))) fail(409, 'Need discussion phase and all answers');
        if (task === 'oracle-vote' && room.status !== 'voting') fail(409, 'Not voting phase');
        if (task === 'shadow' && !['discussion', 'interrogation', 'voting'].includes(room.status)) fail(409, 'Shadow unavailable in this phase');
        if (room.generating) fail(409, 'An AI request is already running for this room');
        const status = room.status;
        const context = {
          scenario: 'Escape Station: determine which escape pod is safe.',
          players: room.players.map(p => ({ id: p.id, name: p.name, evidence: p.evidence, answer: p.answer ?? null, response: p.response ?? null })),
          oracle: room.oracle ?? null,
          ...(task === 'shadow' ? { saboteurId: room.saboteurId, targetPod: 'B' } : {})
        };
        room.generating = true;
        try {
          const output = await generate({ task, context, playerIds: room.players.map(p => p.id) });
          if (room.status !== status) fail(409, 'Phase changed during generation; retry in the current phase');
          if (task === 'oracle') room.oracle = output;
          else if (task === 'oracle-vote') room.oracleVote = output;
          else room.shadowAdvice = output.advice;
          publish(room);
          return send(200, { ok: true, status: room.status });
        } finally { room.generating = false; }
      }
      if (['start', 'advance', 'oracle', 'oracle-vote', 'shadow'].includes(action) && !host) fail(403, 'Host token required');
      if (action === 'ready') {
        if (!player) fail(403, 'Player token required');
        if (!['lobby', 'evidence'].includes(room.status)) fail(409, 'Readiness is only available in lobby or evidence');
        if (typeof body.ready !== 'boolean') fail(400, 'ready must be a boolean');
        player.ready = body.ready;
      } else if (action === 'start') {
        if (room.status !== 'lobby' || room.players.length !== 4) fail(409, 'Start requires four players in lobby');
        if (!room.players.every(p => p.ready)) fail(409, 'All four players must be ready before launch');
        const sabotage = randomInt(4);
        const clues = [
          { kind: 'image', text: 'Security camera shows hull damage around Pod B.', imageUrl: '/evidence/pod-b.svg' },
          { kind: 'text', text: 'Maintenance logs: Pod C failed its oxygen-system test.' },
          { kind: 'text', text: 'Pod D system report: power ONLINE, oxygen ONLINE, navigation ONLINE.' }
        ];
        let clue = 0;
        room.players.forEach((p, i) => {
          p.ready = false;
          p.role = i === sabotage ? 'saboteur' : ['security-officer', 'maintenance-engineer', 'systems-engineer'][clue];
          p.evidence = i === sabotage ? { kind: 'text', text: 'Outdated manifest lists Pod B as ready. Pod A is offline.' } : clues[clue++];
        });
        room.saboteurId = room.players[sabotage].id;
        room.status = 'evidence';
      } else if (action === 'advance') {
        if (room.generating) fail(409, 'Wait for the AI request to finish');
        const next = phases[phases.indexOf(room.status) + 1];
        if (!next || room.status === 'lobby') fail(409, 'Cannot advance; use start from lobby');
        if (room.status === 'evidence' && !room.players.every(p => p.ready)) fail(409, 'All four players must finish reading their evidence');
        if (room.status === 'discussion' && (!room.players.every(p => p.answer) || !room.oracle)) fail(409, 'Need all answers and Oracle analysis');
        if (room.status === 'interrogation' && !room.players.find(p => p.id === room.oracle.interrogate)?.response) fail(409, 'Need interrogation response');
        if (room.status === 'voting' && (!room.players.every(p => p.vote) || !room.oracleVote)) fail(409, 'Need all votes and Oracle vote');
        room.status = next;
      } else if (action === 'answer') {
        if (!player) fail(403, 'Player token required');
        if (room.status !== 'discussion') fail(409, 'Not discussion phase');
        if (player.answer) fail(409, 'Answer already submitted');
        player.answer = requiredText(body.answer);
      } else if (action === 'response') {
        if (!player || player.id !== room.oracle?.interrogate) fail(403, 'Only the interrogated player can respond');
        if (room.status !== 'interrogation') fail(409, 'Not interrogation phase');
        if (player.response) fail(409, 'Response already submitted');
        player.response = requiredText(body.response);
      } else if (action === 'vote') {
        if (!player) fail(403, 'Player token required');
        if (room.status !== 'voting') fail(409, 'Not voting phase');
        if (player.vote) fail(409, 'Vote already locked');
        if (!pods.includes(body.pod) || !room.players.some(p => p.id === body.suspect)) fail(400, 'Invalid pod or suspect');
        player.vote = { pod: body.pod, suspect: body.suspect };
      } else if (action === 'oracle') {
        if (room.status !== 'discussion' || !room.players.every(p => p.answer)) fail(409, 'Need discussion phase and all answers');
        if (!room.players.some(p => p.id === body.suspect) || !room.players.some(p => p.id === body.interrogate)) fail(400, 'Unknown player');
        if (typeof body.confidence !== 'number' || !Number.isFinite(body.confidence) || body.confidence < 0 || body.confidence > 100) fail(400, 'Confidence must be 0–100');
        room.oracle = { suspect: body.suspect, interrogate: body.interrogate, confidence: body.confidence,
          reason: requiredText(body.reason), question: requiredText(body.question) };
      } else if (action === 'oracle-vote') {
        if (room.status !== 'voting') fail(409, 'Not voting phase');
        if (!room.players.some(p => p.id === body.suspect)) fail(400, 'Unknown suspect');
        room.oracleVote = { suspect: body.suspect, reason: requiredText(body.reason) };
      } else if (action === 'shadow') {
        if (!['discussion', 'interrogation', 'voting'].includes(room.status)) fail(409, 'Shadow unavailable in this phase');
        room.shadowAdvice = requiredText(body.advice);
      } else fail(404, 'Route not found');
      publish(room);
      send(200, { ok: true, status: room.status });
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Internal server error' });
      else res.end();
    }
  };
}
