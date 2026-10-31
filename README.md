# Trust No One — integrated game

GitHub Actions runs `.github/workflows/checks.yml` on pushes to `main` and pull requests: tests, lint, TypeScript, and the Cloudflare build. This workflow **does not deploy**. The existing `chatgpt.site` publication is managed through Sites; direct Cloudflare GitHub deployment needs a separately authorized Cloudflare account and deployment target.

The Cloudflare-hosted version lives in [cloud-deploy/README.md](cloud-deploy/README.md). It uses persistent D1 storage and a hosted Gemma API; this root project runs locally with the same hosted Google Gemma adapter by default, plus optional Ollama support. Production publishing is managed through the Sites plugin.

Requires Node 22+. Multiplayer needs no Firebase project or accounts. AI generation uses your Google AI API key by default.

```sh
npm install
npm run backend  # terminal 1
npm run dev      # terminal 2
npm test
```

Open the frontend at `http://localhost:3000`. Backend: `http://localhost:3001`. The frontend proxies room and evidence requests to the backend, so phones only need the frontend address. For phones, use the computer's LAN IP and allow the port through its firewall. Set `ALLOWED_ORIGIN` to the frontend's exact origin (default `http://localhost:3000`). Set `PORT` if needed.

This is a single-server hackathon backend. Rooms live in memory and disappear on restart. Run one instance; persistence and multi-instance hosting are not implemented. Tokens act as session credentials: retain them for reconnects, keep them private, and use HTTPS when hosted. The host token gives trusted game orchestration privileges and belongs in the team's server-side integration, not every player's client.

## Frontend handoff (Person 1)

Create: `POST /api/rooms` with `{"name":"Alex"}`.
Join: `POST /api/rooms/ABC123/join` with `{"name":"Sam"}`.
Both return `{ playerId, playerToken, room }`; creation also returns `hostToken`.
Store the room code and player token per player session so refresh can reconnect. Joining again creates a new seat. Four seats maximum; host is one of the four players.

All remaining requests require `Authorization: Bearer TOKEN`. POST requests take JSON and `Content-Type: application/json`.

| Request | Token | JSON body / behavior |
| --- | --- | --- |
| GET `/api/rooms/:code` | Player | Personalized current snapshot; poll every second for simplest integration |
| GET `/api/rooms/:code/events` | Player | SSE stream of personalized snapshots; use fetch streaming with Authorization (native EventSource cannot set this header) |
| POST `/api/rooms/:code/start` | Host | `{}`; requires four players; assigns one random Saboteur and three evidence roles |
| POST `/api/rooms/:code/advance` | Host | `{}`; advances one phase after prerequisites are satisfied |
| POST `/api/rooms/:code/answer` | Player | `{"answer":"I think D because…"}` |
| POST `/api/rooms/:code/response` | Interrogated player | `{"response":"The report says…"}` |
| POST `/api/rooms/:code/vote` | Player | `{"pod":"D","suspect":"PLAYER_ID"}`; immutable once submitted |

Phases: `lobby → evidence → discussion → interrogation → voting → result`.
Host advances explicitly, so show host controls or have a trusted orchestrator invoke them. Discussion requires all four answers and Oracle analysis before advancement; interrogation requires the selected player's response; voting requires all four votes and Oracle's final vote.

Render `room.me` for private role, evidence, objective, and Shadow advice. Render `room.players` for names, public answers/responses, and submission indicators. Individual human votes stay private until aggregation at reveal. Evidence image URLs are backend-relative: prepend the backend origin. `/evidence/pod-b.png` supplies the built-in illustrative image (the legacy SVG route is also retained); Gemma receives the corresponding PNG bytes automatically when analyzing the evidence.

At `result`, show `room.result`: correct pod, Saboteur ID, winning pod/suspect arrays, survival, human correctness, and Oracle correctness. Tied pod votes count as failure to select a safe pod; tied suspect votes count as failure to identify the Saboteur. Display ties explicitly.

## AI/orchestration handoff (Persons 3 and 4)

The manual endpoints below store externally computed outputs. The backend also supports local Gemma generation (see below). Maritime is not connected yet.

Use the **host token** for these requests:

| Request | Body / response |
| --- | --- |
| GET `/api/rooms/:code/context` | Scenario, evidence assigned to each player, public statements/responses, current Oracle analysis. Excludes actual roles and Saboteur identity to avoid giving Oracle the answer. |
| POST `/api/rooms/:code/oracle` | `{"suspect":"PLAYER_ID","confidence":81,"reason":"Evidence conflicts","interrogate":"PLAYER_ID","question":"Why choose B?"}`; after all answers during discussion |
| POST `/api/rooms/:code/shadow` | `{"advice":"Question the maintenance report."}`; during discussion, interrogation, or voting |
| POST `/api/rooms/:code/oracle-vote` | `{"suspect":"PLAYER_ID","reason":"Contradicts the evidence."}`; during voting; hidden from players until result |

Confidence uses **0–100**. IDs must be actual player IDs. Context includes all evidence for Oracle, including the outdated manifest; it omits secret objectives. Shadow's private input can be assembled by the Saboteur's session from its personalized snapshot and sent to the trusted AI integration, which posts the resulting advice with the host token. Never give the host token to an untrusted player to enable this.

Failures return JSON `{ "error": "..." }` with 400 for invalid input, 401 for missing credentials, 403 for insufficient permissions, 404 for unknown routes/rooms, and 409 for phase/submission conflicts. Health endpoint: `GET /health`.

## Local backend AI configuration

Save `GOOGLE_API_KEY=your_key` in the root `.env`, then run `npm run backend`. The backend loads `.env` automatically and uses the same hosted `gemma-4-26b-a4b-it` model and adapter as production. Restart the backend after changing environment settings. The key stays on the server; never use a `NEXT_PUBLIC_` variable for it.

To use your downloaded model instead, explicitly set `GEMMA_PROVIDER=ollama` in `.env` and run Ollama with `gemma4:e4b`. There is no automatic fallback to Ollama when a Google request fails. See `.env.example`.

Generation uses the host token for Oracle and Oracle voting, and the Saboteur’s player token for Shadow. POST `{}` to:

| Endpoint suffix | When | Effect |
| --- | --- | --- |
| `/generate-oracle` | Discussion, after all four answers | Calls Gemma and saves Oracle analysis and interrogation question |
| `/generate-shadow` | Discussion/interrogation/voting | Calls Gemma and saves private Saboteur advice |
| `/generate-oracle-vote` | Voting | Calls Gemma and saves the hidden final AI vote |

All paths start with `/api/rooms/:code`. Calls await generation and return `{ok:true,status}`; updated outputs arrive through room polling/SSE. Show a loading indicator and disable repeated requests. Generation is explicit, not automatically triggered by submissions. Only one generation runs per room; phase advancement waits for it. Failures return HTTP 502 and leave existing outputs intact, allowing retry.

Configuration: `GEMMA_PROVIDER` (default `google`), `GOOGLE_API_KEY`, and `GOOGLE_GEMMA_MODEL` (default `gemma-4-26b-a4b-it`). For explicit Ollama mode: `OLLAMA_URL` (default `http://localhost:11434`), `GEMMA_MODEL` (default `gemma4:e4b`), `GEMMA_TIMEOUT_MS` (default `180000`). These are server environment variables. Ollama is called by the backend; phones never need direct access to Ollama. A deployed backend needs network access to the model service; its localhost refers to the deployed machine.

Gemma receives **text evidence, conversation, and the security-camera PNG pixels**. Players and the model use the same image. Oracle analysis and final voting both include image input; legacy SVG clue URLs resolve to the same rasterized camera image. Oracle never receives the actual Saboteur ID or human votes; Shadow receives the secret identity and target. This local Shadow call is a temporary integration option, not a Maritime agent.

The adapter uses Ollama's [chat API](https://docs.ollama.com/api/chat) and [JSON schema output](https://docs.ollama.com/capabilities/structured-outputs), with server-side response validation.

## Test the integrated frontend

1. Save your Google API key in the root `.env` (or explicitly configure Ollama as described above).
2. Terminal 1: `npm run backend`.
3. Terminal 2: `npm run dev`.
4. Open `http://localhost:3000` in four independent tabs (open fresh tabs directly; duplicating a tab can copy its session storage). Enter different names. Create one room and join its six-character code in the other three tabs.
5. On the creator's screen, click **Launch Mission**. Each tab must show its own private role/evidence; exactly one shows Saboteur. The Security Officer should see the image.
6. After everyone reads their evidence, the host clicks **Begin discussion**. Submit one argument in each tab. All four public statements should appear everywhere.
7. The Saboteur may click **Ask Shadow** in their private panel. Wait for it to finish; only the Saboteur sees the tip. This uses your configured Gemma provider; Maritime remains for Person 4.
8. With all four arguments submitted, host clicks **Run Oracle + interrogate**. Allow up to three minutes for a cold model load. Every screen moves to interrogation; only the selected player can submit a response.
9. After that response, host clicks **Open voting**. Every player chooses a suspect and pod, then locks the vote. Each player sees only their own locked vote.
10. Once all votes are in, host clicks **Oracle vote + reveal**. Gemma chooses its final suspect; all screens move to the animated reveal with server-calculated human and AI results.
11. Refresh one tab during play: it should resume the same player without taking another seat. Existing rooms are lost if you restart the backend. To start again, use **Return home**, create a fresh room, and join it from the other tabs.

Phone test: put all devices on the same Wi-Fi, find the host laptop's LAN IP, and open `http://LAPTOP_IP:3000` on each device. Keep the host laptop and both app servers running. Ollama is only needed when explicitly selected. Requests travel through Next.js to the local backend, so no frontend API URL or phone access to Ollama is needed. If the OS asks, allow local network access. The room creator controls phases; their host token is kept only in their tab's session storage. This is a trusted demo-host setup.

Verification commands:

- `npm test`: backend flow and privacy/authorization checks using a stubbed model.
- `npm run lint` and `npx tsc --noEmit`: frontend static checks.
- `npm run build`: production build. Then `npm start` runs the production frontend; keep `npm run backend` running separately.
- `npm run test:live`: with both servers running and your selected AI provider configured, creates four sessions through the frontend proxy and plays every phase with real Gemma calls. Consumes a room and may take a few minutes. Set `TEST_URL` to override the frontend URL.

`BACKEND_URL` configures the Next.js proxy destination (default `http://127.0.0.1:3001`). `npm start` now starts the production **frontend**, not the backend.

## Player readiness

Each player, including the host, clicks **I'm ready** in the lobby. The player list shows who is ready; **Launch Mission** unlocks only at 4/4. Players may cancel readiness before launch. After launch, readiness resets: each player clicks **I've read my evidence**. The host's **Begin discussion** button unlocks once all four finish reading. The backend enforces both checks. `POST /api/rooms/:code/ready` takes `{ "ready": true }` (or false) with a player token in lobby/evidence only.

## Fair evidence assignment

At launch, all four legitimate clues are shuffled independently of the secret Saboteur draw. The Saboteur can receive any clue, including the security image or Pod D report. The fourth clue is a legitimate navigation report about Pod A, not a Saboteur-only outdated manifest. Oracle receives evidence and statements without secret roles or objectives; the evidence card itself cannot identify the Saboteur. Start a new game to use this assignment; existing games retain their dealt evidence.

## Private Shadow requests

Only the Saboteur sees **Ask Shadow** in discussion, interrogation, and voting (including after locking their vote). `POST /api/rooms/:code/generate-shadow` requires the Saboteur's **player token**. A host token or any other player's token receives HTTP 403. Advice is included only in the Saboteur's personalized room snapshot; neither Oracle context nor other players receive it. Host controls no longer contain a Shadow button. The trusted server integration may still write agent advice through `/shadow`, but this does not grant read or generation access.

## App link:
https://trust-no-one-crew-game.fasteave1.chatgpt.site/
## Multimodal evidence

The security-camera artwork is rasterized to PNG. `lib/evidence-image.js` in the deployment stores its canonical bytes; the backend serves these at `/evidence/pod-b.png`. Google requests attach those bytes as `inlineData` with `image/png`; optional Ollama requests use the message `images` array. Each image is labeled with the player holding the clue. The payload contains no secret role labels for Oracle. Unknown image URLs fail explicitly instead of being silently ignored. To change the camera image, replace the canonical raster asset and its evidence text together.

## Grounded Oracle interrogation

Oracle still selects a target, but the server builds the displayed question from that target's actual saved answer. The screen shows a verified `statementQuote`. A proposed quote that does not belong to the target falls back to their recorded answer. Optional `evidenceQuote` is used only when it appears verbatim in the evidence belonging to `evidencePlayerId`; otherwise the question asks for supporting evidence without asserting a contradiction. Free-form model accusations are not displayed as interrogation facts. The manual `/oracle` integration also applies these rules. A valid follow-up can question an innocent player; it must not put somebody else's words in their mouth.
