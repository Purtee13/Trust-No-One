import { createGameHandler } from './game-engine.js';
import { hostedGemma } from './hosted-gemma.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function gameFetch(request, env) {
  if (!env.DB) return json(503, { error: 'Room storage is not configured' });
  const url = new URL(request.url);
  if (url.pathname.endsWith('/events')) return json(400, { error: 'Hosted version uses room polling instead of SSE' });
  if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) return json(405, { error: 'Method not allowed' });
  let raw = '';
  if (request.method === 'POST') {
    const reader = request.body?.getReader();
    if (reader) {
      const chunks = []; let size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
        if (size > 16384) { await reader.cancel(); return json(413, { error: 'Body too large' }); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      raw = new TextDecoder().decode(bytes);
    }
  }
  const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{6})/);
  const code = match?.[1].toUpperCase();
  const row = code ? await env.DB.prepare('SELECT data, revision FROM rooms WHERE code = ?').bind(code).first() : null;
  const rooms = new Map();
  if (row) rooms.set(code, JSON.parse(row.data));
  // Game handlers operate on a request-local snapshot. A revision check prevents
  // concurrent requests from overwriting a join, submission, or phase change.
  const handler = createGameHandler({ rooms, generate: input => hostedGemma(input, env) });
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  let status = 200; let responseBody = '';
  const req = {
    method: request.method, url: url.pathname,
    headers: Object.fromEntries(request.headers),
    async *[Symbol.asyncIterator]() { if (raw) yield raw; }
  };
  const res = {
    headersSent: false,
    setHeader(key, value) { if (!key.toLowerCase().startsWith('access-control')) headers.set(key, value); },
    writeHead(value, values = {}) { status = value; for (const [key, value] of Object.entries(values)) headers.set(key, value); this.headersSent = true; },
    end(value = '') { responseBody = value; },
  };
  await handler(req, res);
  if (request.method === 'POST' && status >= 200 && status < 300) {
    const room = rooms.values().next().value;
    if (room) {
      if (row) {
        const updated = await env.DB.prepare('UPDATE rooms SET data = ?, revision = revision + 1, updated_at = ? WHERE code = ? AND revision = ?')
          .bind(JSON.stringify(room), Date.now(), room.code, row.revision).run();
        if (updated.meta.changes !== 1) return json(409, { error: 'Room changed during the request. Retry your action.' });
      } else {
        try { await env.DB.prepare('INSERT INTO rooms (code, data, revision, updated_at) VALUES (?, ?, 0, ?)').bind(room.code, JSON.stringify(room), Date.now()).run(); }
        catch { return json(409, { error: 'Unable to create this room; please retry.' }); }
      }
    }
  }
  return new Response(status === 204 ? null : responseBody, { status, headers });
}
