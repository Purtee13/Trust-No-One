// Client for the Oracle 👁 and Shadow 😈 agents (Cloudflare Worker in /agents).
// Set NEXT_PUBLIC_AGENTS_URL in .env.local, e.g.
//   NEXT_PUBLIC_AGENTS_URL=https://trust-no-one-agents.<your-subdomain>.workers.dev
// Call these from ONE device only (the host), then save the result to the shared game state.
import type { GameState, OracleResult, Pod } from "./types";

const BASE = process.env.NEXT_PUBLIC_AGENTS_URL ?? "http://localhost:8787";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? `Agent error ${r.status}`);
  return data as T;
}

/** Turn frontend game state into the agents' input format. */
function toInput(s: GameState) {
  return {
    room: s.roomCode,
    players: s.players.map((p) => ({ id: p.id, name: p.name })),
    statements: s.players.filter((p) => p.answer).map((p) => ({ playerId: p.id, text: p.answer! })),
    interrogation:
      s.oracle && s.interrogationResponse
        ? { playerId: s.oracle.interrogate, question: s.oracle.question, response: s.interrogationResponse }
        : undefined,
  };
}

export const agents = {
  /** After Round 1 answers -> who to interrogate. Save to state.oracle */
  oracleAnalyze: (s: GameState) => post<OracleResult>("/oracle/analyze", toInput(s)),

  /** At voting -> Oracle's own accusation. Save to state.oracleVote */
  oracleFinal: (s: GameState) =>
    post<{ saboteur: string; pod: Pod; reasoning: string }>("/oracle/final", toInput(s)),

  /** Saboteur's secret tip. Save to state.shadowTip (shown only on the Saboteur's screen) */
  shadowAdvise: (s: GameState) =>
    post<{ tip: string }>("/shadow/advise", { ...toInput(s), saboteurId: s.saboteurId, oracle: s.oracle }),

  /** Clear both agents' memory for this room (new game) */
  reset: (roomCode: string) => post<{ ok: boolean }>("/reset", { room: roomCode }),
};
