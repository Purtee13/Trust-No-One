/**
 * Trust No One — AI agents on Cloudflare.
 *
 * Two Durable Objects with OPPOSING goals, one instance of each per game room:
 *   👁 OracleAgent  — finds the Saboteur, interrogates suspects, makes the final accusation
 *   😈 ShadowAgent  — privately coaches the Saboteur to fool the crew AND the Oracle
 * Each agent keeps its own persistent memory (Durable Object storage) and
 * neither can read the other's state.
 */
import { DurableObject } from "cloudflare:workers";

export interface Env {
  GEMINI_API_KEY: string;
  MODEL?: string;
  EVIDENCE_IMAGE_URL?: string;
  MOCK?: string; // "1" = no Gemma calls (offline testing)
  ORACLE: DurableObjectNamespace<OracleAgent>;
  SHADOW: DurableObjectNamespace<ShadowAgent>;
}

/* ---------------- Game data (keep in sync with game/scenario.ts) ---------------- */
const SCENARIO = `MISSION: ESCAPE STATION. The space station is failing. Four escape pods (A, B, C, D) remain; only one is safe.
One crew member is secretly the SABOTEUR, trying to make the crew pick the wrong pod.
Evidence dealt to the crew (one clue per player; you do NOT know who holds which):
- Security camera image (attached): damage near Pod B.
- Maintenance log: Pod C FAILED its oxygen-system test yesterday.
- Systems report: Pod D — Power ONLINE, Oxygen ONLINE, Navigation ONLINE.
- Navigation report: Pod A's guidance computer is OFFLINE.`;

/* ---------------- Types (match lib/types.ts in the frontend) ---------------- */
type Pod = "A" | "B" | "C" | "D";
type PlayerRef = { id: string; name: string };
type GameInput = {
  room: string;
  players: PlayerRef[];
  statements: { playerId: string; text: string }[];
  interrogation?: { playerId: string; question: string; response: string };
};
type OracleResult = { suspect: string; confidence: number; reason: string; interrogate: string; question: string };
type OracleFinal = { saboteur: string; pod: Pod; reasoning: string };
type ShadowInput = GameInput & { saboteurId: string; oracle?: OracleResult };

/* ---------------- Gemma 4 via Gemini API ---------------- */
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function gemma(env: Env, parts: Part[]): Promise<Record<string, unknown>> {
  const model = env.MODEL || "gemma-4-26b-a4b-it";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.4 } }),
  });
  if (!res.ok) throw new Error(`Gemma ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Gemma returned no JSON: " + text.slice(0, 200));
  return JSON.parse(m[0]);
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const transcript = (g: GameInput) => {
  const name = (id: string) => g.players.find((p) => p.id === id)?.name ?? id;
  const lines = g.statements.map((s) => `${name(s.playerId)} (id=${s.playerId}): "${s.text}"`);
  if (g.interrogation) {
    lines.push(`ORACLE asked ${name(g.interrogation.playerId)}: "${g.interrogation.question}"`);
    lines.push(`${name(g.interrogation.playerId)} replied: "${g.interrogation.response}"`);
  }
  return lines.join("\n") || "(no statements yet)";
};
const roster = (g: GameInput) => g.players.map((p) => `${p.name} (id=${p.id})`).join(", ");

/** Make sure the model returned a real player id (models sometimes return names). */
function toId(players: PlayerRef[], v: unknown, fallback: string): string {
  const s = String(v ?? "").trim().toLowerCase();
  return (
    players.find((p) => p.id.toLowerCase() === s)?.id ??
    players.find((p) => p.name.toLowerCase() === s)?.id ??
    players.find((p) => s.includes(p.name.toLowerCase()) || s.includes(p.id.toLowerCase()))?.id ??
    fallback
  );
}
const clampConf = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 50)));

/* =================================================================== */
/* 👁 ORACLE                                                            */
/* =================================================================== */
type OracleMemory = { analyses: (OracleResult & { at: number })[]; finals: (OracleFinal & { at: number })[] };

export class OracleAgent extends DurableObject<Env> {
  private async mem(): Promise<OracleMemory> {
    return (await this.ctx.storage.get<OracleMemory>("mem")) ?? { analyses: [], finals: [] };
  }

  /** Evidence image is fetched once, then kept in this agent's own storage. */
  private async evidenceImage(): Promise<Part[]> {
    let img = await this.ctx.storage.get<{ mime: string; data: string }>("img");
    if (!img && this.env.EVIDENCE_IMAGE_URL) {
      const r = await fetch(this.env.EVIDENCE_IMAGE_URL);
      if (r.ok) {
        img = { mime: r.headers.get("content-type")?.split(";")[0] || "image/png", data: toBase64(await r.arrayBuffer()) };
        await this.ctx.storage.put("img", img);
      }
    }
    return img ? [{ inline_data: { mime_type: img.mime, data: img.data } }] : [];
  }

  async analyze(g: GameInput): Promise<OracleResult> {
    const mem = await this.mem();
    const first = g.players[0]?.id ?? "";
    let result: OracleResult;

    if (this.env.MOCK === "1") {
      const target = g.statements.find((s) => /\bB\b/i.test(s.text))?.playerId ?? first;
      result = {
        suspect: target, confidence: 70, interrogate: target,
        reason: "Recommends Pod B despite the camera showing damage there.",
        question: "The camera shows damage near Pod B. Why are you still recommending it?",
      };
    } else {
      const prompt = `You are THE ORACLE 👁, an AI detective in a social-deduction game.
${SCENARIO}

Players: ${roster(g)}
Public statements so far:
${transcript(g)}

Your previous suspicions this game: ${JSON.stringify(mem.analyses.map(({ suspect, confidence }) => ({ suspect, confidence })))}

Look at the attached camera image yourself — players may exaggerate or misdescribe it.
Find statements that contradict the evidence. Pick ONE player to interrogate.
Keep "reason" and "question" to ONE short, dramatic sentence each.
Return ONLY JSON with player ids:
{"suspect":"<id>","confidence":0-100,"reason":"","interrogate":"<id>","question":""}`;
      const raw = await gemma(this.env, [{ text: prompt }, ...(await this.evidenceImage())]);
      const suspect = toId(g.players, raw.suspect, first);
      result = {
        suspect,
        confidence: clampConf(raw.confidence),
        reason: String(raw.reason ?? ""),
        interrogate: toId(g.players, raw.interrogate, suspect),
        question: String(raw.question ?? "Explain your reasoning."),
      };
    }

    mem.analyses.push({ ...result, at: Date.now() });
    await this.ctx.storage.put("mem", mem);
    return result;
  }

  async final(g: GameInput): Promise<OracleFinal> {
    const mem = await this.mem();
    const last = mem.analyses.at(-1);
    let result: OracleFinal;

    if (this.env.MOCK === "1") {
      result = { saboteur: last?.suspect ?? g.players[0]?.id ?? "", pod: "D", reasoning: "Pod D is the only pod with every system online." };
    } else {
      const prompt = `You are THE ORACLE 👁. Time for your FINAL decision.
${SCENARIO}

Players: ${roster(g)}
Full transcript:
${transcript(g)}

Your suspicion history this game: ${JSON.stringify(mem.analyses.map(({ suspect, confidence, reason }) => ({ suspect, confidence, reason })))}

Name the Saboteur and the safe pod. "reasoning" = ONE short sentence.
Return ONLY JSON: {"saboteur":"<id>","pod":"A|B|C|D","reasoning":""}`;
      const raw = await gemma(this.env, [{ text: prompt }, ...(await this.evidenceImage())]);
      const pod = String(raw.pod ?? "D").toUpperCase().replace(/[^ABCD]/g, "").slice(0, 1) as Pod;
      result = {
        saboteur: toId(g.players, raw.saboteur, last?.suspect ?? g.players[0]?.id ?? ""),
        pod: pod || "D",
        reasoning: String(raw.reasoning ?? ""),
      };
    }

    mem.finals.push({ ...result, at: Date.now() });
    await this.ctx.storage.put("mem", mem);
    return result;
  }

  async memory() { return this.mem(); }
  async reset() { await this.ctx.storage.deleteAll(); return { ok: true }; }
}

/* =================================================================== */
/* 😈 SHADOW                                                            */
/* =================================================================== */
type ShadowMemory = { tips: { tip: string; at: number }[] };

export class ShadowAgent extends DurableObject<Env> {
  async advise(g: ShadowInput): Promise<{ tip: string }> {
    const mem = (await this.ctx.storage.get<ShadowMemory>("mem")) ?? { tips: [] };
    let tip: string;

    if (this.env.MOCK === "1") {
      tip = "Nobody has proven Pod D's oxygen holds at launch. Question the Systems Engineer's report.";
    } else {
      const me = g.players.find((p) => p.id === g.saboteurId)?.name ?? g.saboteurId;
      const prompt = `You are SHADOW 😈, a secret AI ally of the Saboteur (${me}) in a social-deduction game.
${SCENARIO}

The Saboteur's goal: convince the crew to choose POD B, without being identified.
Players: ${roster(g)}
Public statements:
${transcript(g)}
${g.oracle ? `The Oracle currently suspects ${g.players.find((p) => p.id === g.oracle!.suspect)?.name} (${g.oracle.confidence}%): ${g.oracle.reason}` : "The Oracle has not accused anyone yet."}
Tips you already gave (don't repeat): ${JSON.stringify(mem.tips.map((t) => t.tip))}

Give ONE short tactical suggestion (max 25 words) the Saboteur can act on right now:
cast doubt on a specific player's evidence, or deflect the Oracle's suspicion.
Return ONLY JSON: {"tip":""}`;
      const raw = await gemma(this.env, [{ text: prompt }]);
      tip = String(raw.tip ?? "").trim() || "Stay calm and ask someone else to justify their clue.";
    }

    mem.tips.push({ tip, at: Date.now() });
    await this.ctx.storage.put("mem", mem);
    return { tip };
  }

  async memory() { return (await this.ctx.storage.get<ShadowMemory>("mem")) ?? { tips: [] }; }
  async reset() { await this.ctx.storage.deleteAll(); return { ok: true }; }
}

/* =================================================================== */
/* HTTP router                                                          */
/* =================================================================== */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json", ...CORS } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const oracleFor = (room: string) => env.ORACLE.get(env.ORACLE.idFromName(room));
    const shadowFor = (room: string) => env.SHADOW.get(env.SHADOW.idFromName(room));

    try {
      if (req.method === "GET") {
        if (url.pathname === "/") return json({ ok: true, agents: ["oracle", "shadow"], model: env.MODEL, mock: env.MOCK === "1" });
        const m = url.pathname.match(/^\/memory\/([\w-]+)$/);
        if (m) return json({ room: m[1], oracle: await oracleFor(m[1]).memory(), shadow: await shadowFor(m[1]).memory() });
        return json({ error: "not found" }, 404);
      }

      const body = (await req.json()) as ShadowInput;
      const room = String(body.room || "default");
      if (!Array.isArray(body.players)) body.players = [];
      if (!Array.isArray(body.statements)) body.statements = [];

      switch (url.pathname) {
        case "/oracle/analyze": return json(await oracleFor(room).analyze(body));
        case "/oracle/final":   return json(await oracleFor(room).final(body));
        case "/shadow/advise":  return json(await shadowFor(room).advise(body));
        case "/reset":
          await oracleFor(room).reset();
          await shadowFor(room).reset();
          return json({ ok: true });
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e instanceof Error ? e.message : e) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
