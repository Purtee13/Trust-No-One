# Trust No One — AI agents (Cloudflare Workers + Durable Objects)

Two agents with **opposing goals**, one instance of each per game room, each with its own persistent memory:

| Agent | Goal | Endpoint |
|---|---|---|
| 👁 **Oracle** | Find the Saboteur, interrogate suspects, make the final accusation | `POST /oracle/analyze`, `POST /oracle/final` |
| 😈 **Shadow** | Secretly coach the Saboteur to fool the crew and the Oracle | `POST /shadow/advise` |

Also: `GET /memory/:room` shows both agents' memory, and `POST /reset` clears a room.
Both agents use **Gemma 4** (`gemma-4-26b-a4b-it`) via the Gemini API; the Oracle also looks at the camera-image clue.

## Deploy
```bash
cd agents
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

## Local test without an API key
Create `agents/.dev.vars`:
```
GEMINI_API_KEY=dummy
MOCK=1
```
then run `npx wrangler dev` and open http://localhost:8787
