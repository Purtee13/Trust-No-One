import type { Pod } from "@/lib/types";

export const SCENARIO = {
  title: "STATION ASTERIA",
  year: 2187,
  correctPod: "D" as Pod,
  saboteurTarget: "B" as Pod,
  pods: ["A", "B", "C", "D"] as Pod[],
};

export const POD_NAMES: Record<Pod, string> = { A: "APOLLO", B: "BOREALIS", C: "CYGNUS", D: "DRACO" };

export const SYSTEMS = ["POWER", "NAVIGATION", "OXYGEN"] as const;
export type System = (typeof SYSTEMS)[number];

/** Which system is broken on each pod (used for the reveal). */
export const POD_FAILURE: Record<Pod, System | null> = { A: "NAVIGATION", B: "POWER", C: "OXYGEN", D: null };

export type BriefingLine = { text: string; tone?: "big" | "alert" | "dim" | "pods" };

/** Opening cinematic, shown before players see their evidence. */
export const BRIEFING: BriefingLine[] = [
  { text: "THE YEAR IS 2187.", tone: "big" },
  { text: "You are the final crew aboard Station Asteria, a research station orbiting a dying star." },
  { text: "At 03:17, an explosion ripped through the station.", tone: "alert" },
  { text: "Life support is failing. You have 4 minutes before the station becomes uninhabitable.", tone: "alert" },
  { text: "Four escape pods remain:", tone: "pods" },
  { text: "The blast damaged the central computer. Nobody has complete information about the pods. Each of you holds one surviving piece of evidence." },
  { text: "But the explosion wasn't an accident.", tone: "alert" },
  { text: "One of you is the SABOTEUR. They want you on the wrong pod. And they aren't working alone.", tone: "alert" },
  { text: "The station AI, ORACLE, survived. It doesn't know who the Saboteur is, but it is watching every word.", tone: "dim" },
  { text: "Find the safe pod. Unmask the Saboteur. Someone at the table wants you dead.", tone: "big" },
];

export type RoleInfo = { title: string; icon: string; flavor: string };

export const ROLES: Record<string, RoleInfo> = {
  "security-officer": { title: "SECURITY OFFICER", icon: "📷", flavor: "You recovered the final security image before the explosion." },
  "life-support-engineer": { title: "LIFE SUPPORT ENGINEER", icon: "🫁", flavor: "You recovered part of yesterday's maintenance report." },
  "navigation-engineer": { title: "NAVIGATION ENGINEER", icon: "📡", flavor: "You recovered the navigation diagnostics." },
  "systems-engineer": { title: "SYSTEMS ENGINEER", icon: "⚡", flavor: "You recovered the emergency power report." },
};

export const roleInfo = (role?: string): RoleInfo =>
  (role && ROLES[role]) || { title: (role ?? "CREW MEMBER").replaceAll("-", " ").toUpperCase(), icon: "🧑‍🚀", flavor: "" };

export const SABOTEUR_BRIEF = {
  lines: [
    "You caused the station failure.",
    "Your escape route is already secured.",
  ],
  mission: "CONVINCE THE CREW TO BOARD POD B — BOREALIS.",
  winIf: ["The crew chooses Pod B", "OR the crew fails to identify you"],
  tips: ["Don't make obvious lies.", "Question other people's evidence.", "Create doubt. Redirect suspicion."],
};

export const RULE = "A pod is safe only if ALL THREE systems work: OXYGEN, NAVIGATION and POWER. If even one fails, the pod cannot escape.";
