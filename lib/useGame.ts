"use client";
// MOCK game state. Person 2 replaces the internals with Firebase (or your backend)
// but should KEEP THIS SAME RETURN SHAPE so the UI doesn't change.
import { useState } from "react";
import type { GameState, Phase, Pod } from "./types";
import { MOCK_ORACLE, MOCK_SHADOW } from "@/game/scenario";

export const PHASES: Phase[] = [
  "home", "lobby", "evidence", "discussion", "interrogation", "voting", "result",
];

const initial: GameState = { roomCode: "", phase: "home", players: [], saboteurId: "" };
const FAKE = ["Alex", "Sam", "Maya"];

export function useGame() {
  const [state, setState] = useState<GameState>(initial);
  const [me, setMe] = useState("");

  const up = (p: Partial<GameState>) => setState((s) => ({ ...s, ...p }));
  const mockRoom = (code: string, name: string) => {
    setMe("p1");
    up({
      roomCode: code,
      phase: "lobby",
      players: [{ id: "p1", name }, ...FAKE.map((n, i) => ({ id: `p${i + 2}`, name: n }))],
    });
  };

  return {
    state, me, setMe,

    createRoom(name: string) {
      mockRoom(Math.random().toString(36).slice(2, 6).toUpperCase(), name);
    },
    joinRoom(code: string, name: string) {
      mockRoom(code.toUpperCase(), name);
    },
    startGame() {
      setState((s) => {
        const sab = s.players[Math.floor(Math.random() * s.players.length)].id;
        return { ...s, saboteurId: sab, phase: "evidence" };
      });
    },
    submitAnswer(text: string) {
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === me ? { ...p, answer: text } : p)),
        shadowTip: MOCK_SHADOW, // real: from Shadow agent
      }));
    },
    // real: called after all answers are in -> POST to Oracle agent
    runOracle() {
      setState((s) => ({ ...s, oracle: MOCK_ORACLE(s.saboteurId), phase: "interrogation" }));
    },
    submitInterrogation(text: string) {
      up({ interrogationResponse: text });
    },
    submitVote(saboteur: string, pod: Pod) {
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === me ? { ...p, vote: { saboteur, pod } } : p)),
        oracleVote: { saboteur: s.saboteurId, pod: "D" }, // real: from Oracle agent
      }));
    },
    setPhase(phase: Phase) {
      up({ phase });
    },
    next() {
      setState((s) => ({
        ...s,
        phase: PHASES[Math.min(PHASES.indexOf(s.phase) + 1, PHASES.length - 1)],
      }));
    },
  };
}

export type Game = ReturnType<typeof useGame>;
