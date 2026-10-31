"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, Phase, Pod, OracleResult, Player } from "./types";
export const PHASES: Phase[] = ["home", "lobby", "evidence", "discussion", "interrogation", "voting", "result"];
const initial: GameState = { roomCode: "", phase: "home", players: [], saboteurId: "" };
type Session = { code: string; playerId: string; playerToken: string; hostToken?: string };
type Snapshot = {
  code: string; status: Phase; players: Player[]; oracle: OracleResult | null;
  me: { id: string; role: string | null; evidence: GameState["evidence"]; shadowAdvice: string | null; vote: { pod: Pod; suspect: string } | null };
  result?: GameState["result"];
};
async function request<T = { error?: string }>(path: string, token?: string, body?: object) {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export function useGame() {
  const [state, setState] = useState<GameState>(initial);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const running = useRef(false);
  const apply = useCallback((room: Snapshot) => {
    setState({ roomCode: room.code, phase: room.status,
      players: room.players.map(p => p.id === room.me.id && room.me.vote ? { ...p, vote: { pod: room.me.vote.pod, saboteur: room.me.vote.suspect } } : p),
      saboteurId: room.result?.saboteurId || (room.me.role === "saboteur" ? room.me.id : ""),
      privateRole: room.me.role ?? undefined, evidence: room.me.evidence,
      oracle: room.oracle ?? undefined, shadowTip: room.me.shadowAdvice ?? undefined,
      interrogationResponse: room.players.find(p => p.id === room.oracle?.interrogate)?.response,
      result: room.result,
      oracleVote: room.result ? { saboteur: room.result.oracleVote.suspect, pod: "D" } : undefined });
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try { const saved = sessionStorage.getItem("trust-session"); if (saved) setSession(JSON.parse(saved)); }
      catch { sessionStorage.removeItem("trust-session"); }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const refresh = useCallback(async () => {
    if (session) apply(await request<Snapshot>(`/api/rooms/${session.code}`, session.playerToken));
  }, [session, apply]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const poll = async () => {
      try { const room = await request<Snapshot>(`/api/rooms/${session.code}`, session.playerToken); if (active) apply(room); }
      catch (e) { if (active) setError((e as Error).message); }
    };
    void poll(); const timer = setInterval(poll, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [session, apply]);
  async function perform(label: string, action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(label); setError("");
    try { await action(); } catch (e) { setError((e as Error).message); }
    finally { running.current = false; setBusy(""); }
  }
  async function enter(name: string, code?: string) {
    await perform("Connecting…", async () => {
      const data = await request<{ room: Snapshot; playerId: string; playerToken: string; hostToken?: string }>(code ? `/api/rooms/${code.trim().toUpperCase()}/join` : "/api/rooms", undefined, { name });
      const saved: Session = { code: data.room.code, playerId: data.playerId, playerToken: data.playerToken, hostToken: data.hostToken };
      sessionStorage.setItem("trust-session", JSON.stringify(saved)); setSession(saved); apply(data.room);
    });
  }
  async function post(action: string, body: object = {}, host = false) {
    if (!session) throw new Error("Join a room first");
    const credential = host ? session.hostToken : session.playerToken;
    if (!credential) throw new Error("Only the host can do this");
    await request(`/api/rooms/${session.code}/${action}`, credential, body);
  }
  return {
    state, me: session?.playerId || "", isHost: Boolean(session?.hostToken), error, busy,
    clearError: () => setError(""),
    leave: () => { sessionStorage.removeItem("trust-session"); setSession(null); setState(initial); setError(""); },
    createRoom: (name: string) => enter(name), joinRoom: (code: string, name: string) => enter(name, code),
    setReady: (ready: boolean) => perform("Updating readiness…", async () => { await post("ready", { ready }); await refresh(); }),
    startGame: () => perform("Launching…", async () => { await post("start", {}, true); await refresh(); }),
    submitAnswer: (answer: string) => perform("Submitting…", async () => { await post("answer", { answer }); await refresh(); }),
    submitInterrogation: (response: string) => perform("Submitting…", async () => { await post("response", { response }); await refresh(); }),
    submitVote: (suspect: string, pod: Pod) => perform("Locking vote…", async () => { await post("vote", { suspect, pod }); await refresh(); }),
    next: () => perform("Advancing…", async () => { await post("advance", {}, true); await refresh(); }),
    runOracle: () => perform("Oracle is thinking…", async () => { await post("generate-oracle", {}, true); await post("advance", {}, true); await refresh(); }),
    runShadow: () => perform("Shadow is thinking…", async () => { await post("generate-shadow", {}, true); await refresh(); }),
    reveal: () => perform("Oracle is casting its final vote…", async () => { await post("generate-oracle-vote", {}, true); await post("advance", {}, true); await refresh(); }),
  };
}
export type Game = ReturnType<typeof useGame>;
