import type { OracleResult, Player, Pod } from "@/lib/types";

export const SCENARIO = {
  title: "ESCAPE STATION",
  intro: "The station is failing. Four escape pods remain, but only one is safe.",
  correctPod: "D" as Pod,
  saboteurTarget: "B" as Pod,
  pods: ["A", "B", "C", "D"] as Pod[],
};

export type RoleCard = {
  role: string;
  icon: string;
  evidenceText: string;
  image?: string; // put files in /public/evidence/
};

// Non-saboteurs get cards 0,1,2 in join order. The Saboteur always gets card 3
// (true-but-harmless info) plus the secret objective.
export const ROLE_CARDS: RoleCard[] = [
  { role: "SECURITY OFFICER", icon: "📷",
    evidenceText: "Security camera, sector 2: damage near Pod B.",
    image: "/evidence/pod-b-camera.png" },
  { role: "MAINTENANCE ENGINEER", icon: "🔧",
    evidenceText: "Maintenance log: Pod C FAILED its oxygen-system test yesterday." },
  { role: "SYSTEMS ENGINEER", icon: "📊",
    evidenceText: "Pod D status — Power: ONLINE · Oxygen: ONLINE · Navigation: ONLINE" },
  { role: "NAVIGATION OFFICER", icon: "🧭",
    evidenceText: "Navigation report: Pod A's guidance computer is OFFLINE." },
];

export function roleFor(players: Player[], saboteurId: string, playerId: string): RoleCard {
  if (playerId === saboteurId) return ROLE_CARDS[3];
  const honest = players.filter((p) => p.id !== saboteurId);
  const i = honest.findIndex((p) => p.id === playerId);
  return ROLE_CARDS[Math.max(0, i) % 3];
}

// ---- Mock AI output until Person 3/4's endpoints are ready ----
export const MOCK_ORACLE = (interrogate: string): OracleResult => ({
  suspect: interrogate,
  confidence: 72,
  reason: "Keeps defending Pod B despite the camera evidence.",
  interrogate,
  question: "You keep recommending Pod B even though the camera shows damage there. Why should we trust you?",
});

export const MOCK_SHADOW =
  "Nobody has proven Pod D's oxygen holds under launch. Question the Systems Engineer's report.";
