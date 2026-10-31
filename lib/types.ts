export type Phase =
  | "home" | "lobby" | "evidence" | "discussion"
  | "interrogation" | "voting" | "result";

export type Pod = "A" | "B" | "C" | "D";

export type Player = {
  id: string;
  name: string;
  answer?: string;                       // Round 1 answer
  vote?: { saboteur: string; pod: Pod }; // final vote
};

export type OracleResult = {
  suspect: string;       // player id
  confidence: number;    // 0-100
  reason: string;
  interrogate: string;   // player id
  question: string;
};

export type GameState = {
  roomCode: string;
  phase: Phase;
  players: Player[];
  saboteurId: string;
  oracle?: OracleResult;                       // from Person 3/4
  shadowTip?: string;                          // from Person 4 (Saboteur only)
  interrogationResponse?: string;
  oracleVote?: { saboteur: string; pod: Pod }; // Oracle's final accusation
};
