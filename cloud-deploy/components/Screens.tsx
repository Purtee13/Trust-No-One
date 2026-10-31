"use client";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/useGame";
import type { Pod } from "@/lib/types";
import { SCENARIO } from "@/game/scenario";
import { Btn, Label, Panel, TextBox, Timer } from "./ui";

// Demo-mode timers (seconds)
export const TIMES = { discussion: 45, interrogation: 60, voting: 20 };

const nameOf = (g: Game, id?: string) => g.state.players.find((p) => p.id === id)?.name ?? "—";

/* ---------------- 1. HOME ---------------- */
export function Home({ g }: { g: Game }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="space-y-6 text-center">
      <div className="py-8">
        <div className="text-7xl mb-3">👁</div>
        <h1 className="text-4xl font-black tracking-[0.2em] text-emerald-300">TRUST NO ONE</h1>
        <p className="text-emerald-700 mt-2 text-sm">One of you is lying. The Oracle is watching.</p>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="YOUR NAME"
        className="w-full bg-black border border-emerald-700 rounded-lg p-3 text-center tracking-widest" />
      <Btn disabled={!name} onClick={() => g.createRoom(name)}>Create Game</Btn>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ROOM CODE" maxLength={6}
          className="flex-1 bg-black border border-emerald-700 rounded-lg p-3 text-center tracking-[0.4em] uppercase" />
        <Btn className="!w-28" disabled={!name || code.trim().length !== 6} onClick={() => g.joinRoom(code, name)}>Join</Btn>
      </div>
    </div>
  );
}

/* ---------------- 2. LOBBY ---------------- */
export function Lobby({ g }: { g: Game }) {
  const { state } = g;
  return (
    <Panel>
      <Label>Room code</Label>
      <p className="text-5xl font-black tracking-[0.4em] text-center my-4">{state.roomCode}</p>
      <Label>Crew ({state.players.length}/4)</Label>
      <ul className="space-y-2 mb-6">
        {state.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2"><span className="text-emerald-400">●</span>{p.name}</li>
        ))}
        {Array.from({ length: Math.max(0, 4 - state.players.length) }).map((_, i) => (
          <li key={i} className="text-emerald-900 animate-pulse">○ waiting…</li>
        ))}
      </ul>
      {g.isHost ? <Btn disabled={state.players.length < 4} onClick={g.startGame}>Launch Mission 🚀</Btn> : <p>Waiting for the host to launch…</p>}
    </Panel>
  );
}

/* ---------------- 3. PRIVATE ROLE + EVIDENCE ---------------- */
export function Evidence({ g }: { g: Game }) {
  const { state, me } = g;
  const card = { role: state.privateRole?.replaceAll("-", " ").toUpperCase(), icon: "🧑‍🚀", image: state.evidence?.imageUrl, evidenceText: state.evidence?.text };
  const isSab = me === state.saboteurId;
  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-emerald-600 text-sm">🚀 {SCENARIO.title}</p>
        <p className="text-emerald-200 mt-1">{SCENARIO.intro}</p>
      </Panel>
      <Panel>
        <Label>Your role</Label>
        <p className="text-2xl font-black">{card.icon} {card.role}</p>
        <div className="mt-4"><Label>Private evidence</Label></div>
        {card.image && <EvidenceImage src={card.image} />}
        <p className="text-emerald-100">{card.evidenceText}</p>
      </Panel>
      {isSab && (
        <Panel glow="red">
          <p className="text-2xl font-black text-red-500">😈 YOU ARE THE SABOTEUR</p>
          <p className="mt-2 text-red-200">Convince the crew to choose <b>POD {SCENARIO.saboteurTarget}</b>.</p>
          <p className="text-red-400 text-sm mt-1">Oracle is watching. Don&apos;t get caught.</p>
        </Panel>
      )}
      <p className="text-center text-xs text-red-400 tracking-widest">⚠ DO NOT SHOW THIS SCREEN</p>
      <p className="text-center text-sm">Read your evidence. The host will begin discussion when everyone is ready.</p>
    </div>
  );
}

function EvidenceImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="evidence" onError={() => setOk(false)}
      className="w-full rounded-lg border border-emerald-800 mb-3" />
  ) : (
    <div className="w-full h-40 rounded-lg border border-dashed border-emerald-800 mb-3 grid place-items-center text-emerald-800">
      [ camera image missing — add {src} ]
    </div>
  );
}

/* ---------------- Shadow whisper (Saboteur only) ---------------- */
function ShadowTip({ g }: { g: Game }) {
  if (g.me !== g.state.saboteurId || !g.state.shadowTip) return null;
  return (
    <Panel glow="red">
      <p className="text-red-500 font-black">😈 SHADOW <span className="text-xs text-red-800">(only you see this)</span></p>
      <p className="text-red-200 mt-2 italic">“{g.state.shadowTip}”</p>
    </Panel>
  );
}

/* ---------------- 4. DISCUSSION / ROUND 1 ---------------- */
export function Discussion({ g }: { g: Game }) {
  const [text, setText] = useState("");
  const mine = g.state.players.find((p) => p.id === g.me);
  const answered = g.state.players.filter((p) => p.answer).length;
  return (
    <div className="space-y-4">
      <Timer seconds={TIMES.discussion} resetKey="discussion" />
      <Panel>
        <p className="text-emerald-400 font-black">👁 ORACLE ASKS</p>
        <p className="text-xl mt-2">Which pod do you believe is safest? Explain why.</p>
      </Panel>
      {mine?.answer ? (
        <Panel><Label>Your answer</Label><p>“{mine.answer}”</p></Panel>
      ) : (
        <>
          <TextBox value={text} onChange={setText} placeholder="I think Pod __ because…" />
          <Btn disabled={!text} onClick={() => g.submitAnswer(text)}>Submit</Btn>
        </>
      )}
      <ShadowTip g={g} />
      <p className="text-center text-emerald-700 text-sm">{answered}/{g.state.players.length} crew answered</p>
      <AnswersFeed g={g} />
    </div>
  );
}

function AnswersFeed({ g }: { g: Game }) {
  const answers = g.state.players.filter((p) => p.answer);
  if (!answers.length) return null;
  return (
    <Panel>
      <Label>Crew statements</Label>
      <ul className="space-y-2">
        {answers.map((p) => <li key={p.id}><b className="text-emerald-400">{p.name}:</b> {p.answer}</li>)}
      </ul>
    </Panel>
  );
}

/* ---------------- 5. ORACLE INTERVENTION ---------------- */
export function Interrogation({ g }: { g: Game }) {
  const [text, setText] = useState("");
  const o = g.state.oracle;
  if (!o) return <OracleThinking />;
  const targeted = g.me === o.interrogate;
  return (
    <div className="space-y-4">
      <Timer seconds={TIMES.interrogation} resetKey="interrogation" />
      <Panel glow="amber">
        <p className="text-amber-400 font-black text-xl animate-pulse">🚨 ORACLE INTERVENTION</p>
        <p className="mt-3 text-amber-100"><b>{nameOf(g, o.interrogate)}:</b> {o.question}</p>
      </Panel>
      {targeted && !g.state.interrogationResponse && (
        <>
          <TextBox value={text} onChange={setText} placeholder="Defend yourself…" />
          <Btn onClick={() => g.submitInterrogation(text)} disabled={!text}>Respond</Btn>
        </>
      )}
      {g.state.interrogationResponse && (
        <Panel><Label>{nameOf(g, o.interrogate)} responds</Label><p>“{g.state.interrogationResponse}”</p></Panel>
      )}
      <ShadowTip g={g} />
      <AnswersFeed g={g} />
    </div>
  );
}

function OracleThinking() {
  return (
    <Panel>
      <div className="text-center py-10">
        <div className="text-6xl animate-pulse">👁</div>
        <p className="mt-4 tracking-widest text-emerald-400">ORACLE IS ANALYZING EVIDENCE…</p>
      </div>
    </Panel>
  );
}

/* ---------------- 6. VOTING ---------------- */
export function Voting({ g }: { g: Game }) {
  const [sab, setSab] = useState("");
  const [pod, setPod] = useState<Pod | "">("");
  const mine = g.state.players.find((p) => p.id === g.me);
  if (mine?.vote) {
    return <Panel><p className="text-center py-8 tracking-widest">🔒 VOTE LOCKED. Waiting for crew…</p></Panel>;
  }
  return (
    <div className="space-y-4">
      <Timer seconds={TIMES.voting} resetKey="voting" />
      <Panel>
        <Label>Who is the Saboteur?</Label>
        <div className="grid grid-cols-2 gap-2">
          {g.state.players.filter((p) => p.id !== g.me).map((p) => (
            <Choice key={p.id} on={sab === p.id} onClick={() => setSab(p.id)}>{p.name}</Choice>
          ))}
        </div>
      </Panel>
      <Panel>
        <Label>Which pod is safe?</Label>
        <div className="grid grid-cols-4 gap-2">
          {SCENARIO.pods.map((x) => <Choice key={x} on={pod === x} onClick={() => setPod(x)}>{x}</Choice>)}
        </div>
      </Panel>
      <Btn variant="danger" disabled={!sab || !pod} onClick={() => g.submitVote(sab, pod as Pod)}>Lock in</Btn>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`py-3 rounded-lg border font-bold transition ${on ? "bg-emerald-500 text-black border-emerald-300" : "border-emerald-800 hover:border-emerald-500"}`}>
      {children}
    </button>
  );
}

/* ---------------- 7. REVEAL ---------------- */
export function Result({ g }: { g: Game }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= 5) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1800);
    return () => clearTimeout(t);
  }, [step]);

  const { state } = g;
  const result = state.result;
  const crewPod = result?.chosenPods.join(" / ");
  const crewSus = result?.suspects.length === 1 ? result.suspects[0] : undefined;
  const survived = result?.survived;
  const humansRight = result?.humansCorrect;
  const oracleRight = result?.oracleCorrect;
  const verdict =
    humansRight && !oracleRight ? "🧠 HUMANS BEAT THE AI" :
    !humansRight && oracleRight ? "👁 THE ORACLE WINS" :
    humansRight && oracleRight ? "🤝 HUMANS + ORACLE CAUGHT THE SABOTEUR" :
    "😈 THE SABOTEUR FOOLED EVERYONE";

  return (
    <div className="space-y-4 text-center">
      <Panel glow={step >= 1 ? (survived ? "green" : "red") : "green"}>
        <Label>{result?.tiedPodVote ? "Crew vote tied — no pod selected" : "The crew chose"}</Label>
        <p className="text-5xl font-black">🚀 POD {crewPod ?? "?"}</p>
        {step >= 1 && (
          <div className="mt-4 space-y-1">
            <Label>System check</Label>
            {survived
              ? <><p>POWER ✓</p><p>OXYGEN ✓</p><p>NAVIGATION ✓</p><p className="text-3xl font-black text-emerald-400 mt-3">YOU SURVIVED</p></>
              : <p className="text-3xl font-black text-red-500">💥 NO SAFE ESCAPE</p>}
          </div>
        )}
      </Panel>
      {step >= 2 && (
        <Panel glow="red">
          <Label>The Saboteur was…</Label>
          <p className="text-4xl font-black text-red-500">😈 {nameOf(g, state.saboteurId)}</p>
        </Panel>
      )}
      {step >= 3 && (
        <Panel>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Humans suspected</Label><p className="text-xl font-bold">{result?.tiedSuspectVote ? "Tie: " + result.suspects.map(id => nameOf(g, id)).join(" / ") : nameOf(g, crewSus)} {humansRight ? "✅" : "❌"}</p></div>
            {step >= 4 && <div><Label>Oracle suspected</Label><p className="text-xl font-bold">{nameOf(g, state.oracleVote?.saboteur)} {oracleRight ? "✅" : "❌"}</p></div>}
          </div>
        </Panel>
      )}
      {step >= 5 && <p className="text-3xl font-black tracking-wide animate-pulse">{verdict}</p>}
    </div>
  );
}
