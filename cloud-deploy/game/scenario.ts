import type { Pod } from "@/lib/types";

export const SCENARIO = {
  title: "ESCAPE STATION",
  intro: "The station is failing. Four escape pods remain, but only one is safe.",
  correctPod: "D" as Pod,
  saboteurTarget: "B" as Pod,
  pods: ["A", "B", "C", "D"] as Pod[],
};

