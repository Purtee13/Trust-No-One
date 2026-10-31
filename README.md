# 👁 Trust No One

A multiplayer social-deduction game where **humans and AI agents with opposing goals** play together.

- One player is secretly the **Saboteur**, trying to send the crew to the wrong escape pod.
- **Oracle** 👁 — an AI detective that reads every clue (including images) and every statement, finds contradictions, and interrogates suspects.
- **Shadow** 😈 — a second AI that privately coaches the Saboteur to fool both the humans and Oracle.

Built at Hacktoberfest Hack Day Raleigh (Hack_NCState × Applied AI Club at NC State), Oct 31, 2026.

## How to run
```bash
npm install
npm run dev            # http://localhost:3000
npm run dev -- -H 0.0.0.0   # play from phones on the same WiFi
```

## Project structure
| Path | What |
|---|---|
| `components/Screens.tsx` | All game screens (lobby → evidence → discussion → Oracle intervention → vote → reveal) |
| `game/scenario.ts` | Hardcoded "Escape Station" mission, role cards, evidence |
| `lib/types.ts` | Shared game-state shape (frontend ↔ backend ↔ AI agents) |
| `lib/useGame.ts` | Game-state hook (mock now → multiplayer backend) |
| `public/evidence/` | Image clues (e.g. `pod-b-camera.png`) |

## Models
- **Gemma 4 26B A4B** (`gemma-4-26b-a4b-it`) via the Gemini API — open-weight, Apache 2.0: https://ai.google.dev/gemma/terms

## Built with
Next.js, React, Tailwind CSS, Gemma 4 (Gemini API), Maritime (agent hosting)

## License
MIT — see [LICENSE](LICENSE).
