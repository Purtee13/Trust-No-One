# Trust No One — Cloudflare deployment

This directory is the deployable version of the existing frontend and multiplayer backend. It uses the Sites Vinext starter on Cloudflare Workers and D1 for persistent rooms. The root project remains the local Node/Ollama version.

## Run locally

Use the Sites skill build and deployment workflow. `npm run build` builds the Worker; `npm start` previews it locally. Apply the generated migration to the local DB before testing; see the starter scripts and `drizzle/`.

`node --test lib/hosted-api.test.mjs` verifies the persistent room flow, hidden roles, and missing-model errors. `npx tsc --noEmit` verifies TypeScript. Browser visual QA has not been automated.

## AI configuration

Production secrets are managed by Sites environment-variable tools, not in source or hosting.json. Required: `GOOGLE_API_KEY`. Optional: `GOOGLE_GEMMA_MODEL`, default `gemma-4-26b-a4b-it`. This is Google's hosted Gemma, not the laptop's Ollama E4B model. No key is included in client code. Without the key, joining, roles, evidence, answers and manual agent endpoints work; generation returns 503.

Get a key at https://aistudio.google.com/apikey. Configure it as a production runtime secret, then publish. Google documents hosted Gemma at https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api.

## Test with teammates

Open the published URL on any network. Create one room, then join its six-character code from three other devices or fresh tabs. The creator launches and controls phases. Submit all four answers before running Oracle. The targeted player responds; host opens voting. After all four votes, host requests Oracle's final vote and reveal. Shadow advice is visible only to the Saboteur. No shared Wi-Fi or running laptop is needed once hosted AI is configured.

The existing room codes from localhost do not transfer to this deployment. Create a new hosted room. Keep your tab open: its session token is stored in sessionStorage; refreshing reconnects, closing the tab may lose the credential. Returning home does not remove an occupied seat; create a new room for a fresh game.

## Architecture

- `lib/game-engine.js`: existing backend rules adapted into a reusable request handler.
- `lib/hosted-api.js`: Worker request adapter and D1 storage. Updates use revision checks so concurrent submissions cannot overwrite each other. On HTTP 409, retry the action.
- `lib/hosted-gemma.js`: hosted Gemma adapter and response validation.
- `worker/index.ts`: routes room/evidence requests to the backend and pages to Vinext; preserves the starter's integration.
- `lib/useGame.ts`: personalized polling, player sessions and host controls.
- `db/schema.ts` and `drizzle/`: room storage migration.

Gemma receives text evidence, statements, and actual security-camera image pixels. Maritime agent orchestration remains to be integrated. The host-authenticated manual `/oracle`, `/shadow`, and `/oracle-vote` write endpoints remain available for trusted Maritime orchestration; they do not return private Shadow advice. Production room state persists across Worker deployments.

## Player readiness

Each player, including the host, clicks **I'm ready** in the lobby. The player list shows who is ready; **Launch Mission** unlocks only at 4/4. Players may cancel readiness before launch. After launch, readiness resets: each player clicks **I've read my evidence**. The host's **Begin discussion** button unlocks once all four finish reading. The backend enforces both checks. `POST /api/rooms/:code/ready` takes `{ "ready": true }` (or false) with a player token in lobby/evidence only.

## Fair evidence assignment

At launch, all four legitimate clues are shuffled independently of the secret Saboteur draw. The Saboteur can receive any clue, including the security image or Pod D report. The fourth clue is a legitimate navigation report about Pod A, not a Saboteur-only outdated manifest. Oracle receives evidence and statements without secret roles or objectives; the evidence card itself cannot identify the Saboteur. Start a new game to use this assignment; existing games retain their dealt evidence.

## Private Shadow requests

Only the Saboteur sees **Ask Shadow** in discussion, interrogation, and voting (including after locking their vote). `POST /api/rooms/:code/generate-shadow` requires the Saboteur's **player token**. A host token or any other player's token receives HTTP 403. Advice is included only in the Saboteur's personalized room snapshot; neither Oracle context nor other players receive it. Host controls no longer contain a Shadow button. The trusted server integration may still write agent advice through `/shadow`, but this does not grant read or generation access.

## Multimodal evidence

The security-camera artwork is rasterized to PNG. `lib/evidence-image.js` in the deployment stores its canonical bytes; the backend serves these at `/evidence/pod-b.png`. Google requests attach those bytes as `inlineData` with `image/png`; optional Ollama requests use the message `images` array. Each image is labeled with the player holding the clue. The payload contains no secret role labels for Oracle. Unknown image URLs fail explicitly instead of being silently ignored. To change the camera image, replace the canonical raster asset and its evidence text together.

## Grounded Oracle interrogation

Oracle still selects a target, but the server builds the displayed question from that target's actual saved answer. The screen shows a verified `statementQuote`. A proposed quote that does not belong to the target falls back to their recorded answer. Optional `evidenceQuote` is used only when it appears verbatim in the evidence belonging to `evidencePlayerId`; otherwise the question asks for supporting evidence without asserting a contradiction. Free-form model accusations are not displayed as interrogation facts. The manual `/oracle` integration also applies these rules. A valid follow-up can question an innocent player; it must not put somebody else's words in their mouth.
