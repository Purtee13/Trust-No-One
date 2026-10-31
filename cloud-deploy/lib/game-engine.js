import { SECURITY_IMAGE } from './evidence-image.js';
import { assignRoles } from './assign-roles.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';

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
      objective: player.role === 'saboteur' ? 'Convince the crew to board Pod B (Borealis). You win if they choose Pod B or fail to identify you. Avoid obvious lies.' : null,
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
      if (req.method === 'GET' && url.pathname === '/evidence/pod-b.png') {
        res.writeHead(200, { 'Content-Type': SECURITY_IMAGE.mimeType });
        return res.end(Buffer.from(SECURITY_IMAGE.data, 'base64'));
      }
      if (req.method === 'GET' && url.pathname === '/evidence/pod-b.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#05070d"/><g stroke="#1e293b" stroke-width="1"><line x1="0" y1="0" x2="800" y2="0"/><line x1="0" y1="6" x2="800" y2="6"/><line x1="0" y1="12" x2="800" y2="12"/><line x1="0" y1="18" x2="800" y2="18"/><line x1="0" y1="24" x2="800" y2="24"/><line x1="0" y1="30" x2="800" y2="30"/><line x1="0" y1="36" x2="800" y2="36"/><line x1="0" y1="42" x2="800" y2="42"/><line x1="0" y1="48" x2="800" y2="48"/><line x1="0" y1="54" x2="800" y2="54"/><line x1="0" y1="60" x2="800" y2="60"/><line x1="0" y1="66" x2="800" y2="66"/><line x1="0" y1="72" x2="800" y2="72"/><line x1="0" y1="78" x2="800" y2="78"/><line x1="0" y1="84" x2="800" y2="84"/><line x1="0" y1="90" x2="800" y2="90"/><line x1="0" y1="96" x2="800" y2="96"/><line x1="0" y1="102" x2="800" y2="102"/><line x1="0" y1="108" x2="800" y2="108"/><line x1="0" y1="114" x2="800" y2="114"/><line x1="0" y1="120" x2="800" y2="120"/><line x1="0" y1="126" x2="800" y2="126"/><line x1="0" y1="132" x2="800" y2="132"/><line x1="0" y1="138" x2="800" y2="138"/><line x1="0" y1="144" x2="800" y2="144"/><line x1="0" y1="150" x2="800" y2="150"/><line x1="0" y1="156" x2="800" y2="156"/><line x1="0" y1="162" x2="800" y2="162"/><line x1="0" y1="168" x2="800" y2="168"/><line x1="0" y1="174" x2="800" y2="174"/><line x1="0" y1="180" x2="800" y2="180"/><line x1="0" y1="186" x2="800" y2="186"/><line x1="0" y1="192" x2="800" y2="192"/><line x1="0" y1="198" x2="800" y2="198"/><line x1="0" y1="204" x2="800" y2="204"/><line x1="0" y1="210" x2="800" y2="210"/><line x1="0" y1="216" x2="800" y2="216"/><line x1="0" y1="222" x2="800" y2="222"/><line x1="0" y1="228" x2="800" y2="228"/><line x1="0" y1="234" x2="800" y2="234"/><line x1="0" y1="240" x2="800" y2="240"/><line x1="0" y1="246" x2="800" y2="246"/><line x1="0" y1="252" x2="800" y2="252"/><line x1="0" y1="258" x2="800" y2="258"/><line x1="0" y1="264" x2="800" y2="264"/><line x1="0" y1="270" x2="800" y2="270"/><line x1="0" y1="276" x2="800" y2="276"/><line x1="0" y1="282" x2="800" y2="282"/><line x1="0" y1="288" x2="800" y2="288"/><line x1="0" y1="294" x2="800" y2="294"/><line x1="0" y1="300" x2="800" y2="300"/><line x1="0" y1="306" x2="800" y2="306"/><line x1="0" y1="312" x2="800" y2="312"/><line x1="0" y1="318" x2="800" y2="318"/><line x1="0" y1="324" x2="800" y2="324"/><line x1="0" y1="330" x2="800" y2="330"/><line x1="0" y1="336" x2="800" y2="336"/><line x1="0" y1="342" x2="800" y2="342"/><line x1="0" y1="348" x2="800" y2="348"/><line x1="0" y1="354" x2="800" y2="354"/><line x1="0" y1="360" x2="800" y2="360"/><line x1="0" y1="366" x2="800" y2="366"/><line x1="0" y1="372" x2="800" y2="372"/><line x1="0" y1="378" x2="800" y2="378"/><line x1="0" y1="384" x2="800" y2="384"/><line x1="0" y1="390" x2="800" y2="390"/><line x1="0" y1="396" x2="800" y2="396"/><line x1="0" y1="402" x2="800" y2="402"/><line x1="0" y1="408" x2="800" y2="408"/><line x1="0" y1="414" x2="800" y2="414"/><line x1="0" y1="420" x2="800" y2="420"/><line x1="0" y1="426" x2="800" y2="426"/><line x1="0" y1="432" x2="800" y2="432"/><line x1="0" y1="438" x2="800" y2="438"/><line x1="0" y1="444" x2="800" y2="444"/></g><text x="28" y="44" fill="#e2e8f0" font-family="monospace" font-size="22">CAM 07 · DOCKING RING · POD B — BOREALIS</text><text x="600" y="44" fill="#ef4444" font-family="monospace" font-size="22">● REC 03:16:58</text><rect x="255" y="95" width="290" height="270" rx="80" fill="#475569" stroke="#94a3b8" stroke-width="4"/><circle cx="400" cy="190" r="50" fill="#0c4a6e" stroke="#38bdf8" stroke-width="4"/><text x="372" y="300" fill="#e2e8f0" font-family="monospace" font-size="40" font-weight="bold">B</text><path d="M545 250 C600 250 610 300 660 300 L700 300" stroke="#facc15" stroke-width="10" fill="none"/><path d="M545 285 C590 285 600 330 640 345" stroke="#facc15" stroke-width="10" fill="none"/><path d="M700 300 l20 -18 m-20 18 l24 6 m-24 -6 l14 22" stroke="#f97316" stroke-width="5"/><path d="M640 345 l18 -20 m-18 20 l22 4 m-22 -4 l8 24" stroke="#f97316" stroke-width="5"/><rect x="600" y="265" width="140" height="110" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="10 6"/><text x="28" y="420" fill="#fca5a5" font-family="monospace" font-size="22">ALERT: EXTERNAL POWER CABLES DAMAGED</text></svg>');
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
          scenario: { title: 'Station Asteria', story: "Station Asteria, year 2187: an explosion (sabotage) left life support failing. Four escape pods: A Apollo, B Borealis, C Cygnus, D Draco. A pod is safe only if OXYGEN, NAVIGATION and POWER all work. Each crew member holds one surviving piece of evidence. One crew member is the Saboteur, who caused the explosion and wants the crew to board the wrong pod. Determine which escape pod is safe.", question: 'Which escape pod is safe?' },
          evidence: room.players.map(p => ({ playerId: p.id, evidence: p.evidence })),
          statements: room.players.map(p => ({ playerId: p.id, name: p.name, answer: p.answer ?? null, response: p.response ?? null })),
          oracle: room.oracle ?? null });
      }
      if (req.method !== 'POST') fail(404, 'Route not found');
      if (action?.startsWith('generate-')) {
        const task = action.slice('generate-'.length);
        if (!['oracle', 'oracle-vote', 'shadow'].includes(task)) fail(404, 'Route not found');
        if (task === 'shadow') {
          if (!player || player.id !== room.saboteurId) fail(403, 'Only the Saboteur can ask Shadow');
        } else if (!host) fail(403, 'Host token required');
        if (task === 'oracle' && (room.status !== 'discussion' || !room.players.every(p => p.answer))) fail(409, 'Need discussion phase and all answers');
        if (task === 'oracle-vote' && room.status !== 'voting') fail(409, 'Not voting phase');
        if (task === 'shadow' && !['discussion', 'interrogation', 'voting'].includes(room.status)) fail(409, 'Shadow unavailable in this phase');
        if (room.generating) fail(409, 'An AI request is already running for this room');
        const status = room.status;
        const context = {
          scenario: "Station Asteria, year 2187: an explosion (sabotage) left life support failing. Four escape pods: A Apollo, B Borealis, C Cygnus, D Draco. A pod is safe only if OXYGEN, NAVIGATION and POWER all work. Each crew member holds one surviving piece of evidence. One crew member is the Saboteur, who caused the explosion and wants the crew to board the wrong pod. Determine which escape pod is safe.",
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
        room.saboteurId = assignRoles(room.players);
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
