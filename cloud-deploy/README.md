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

Gemma currently receives text evidence and statements. Image pixels and Maritime agent orchestration remain to be integrated. The host-authenticated manual `/oracle`, `/shadow`, and `/oracle-vote` endpoints are available for Maritime later. Production room state persists across Worker deployments.

## Player readiness

Each player, including the host, clicks **I'm ready** in the lobby. The player list shows who is ready; **Launch Mission** unlocks only at 4/4. Players may cancel readiness before launch. After launch, readiness resets: each player clicks **I've read my evidence**. The host's **Begin discussion** button unlocks once all four finish reading. The backend enforces both checks. `POST /api/rooms/:code/ready` takes `{ "ready": true }` (or false) with a player token in lobby/evidence only.
