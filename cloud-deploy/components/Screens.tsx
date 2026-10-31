"use client";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/useGame";
import type { Pod } from "@/lib/types";
import { POD_FAILURE, POD_NAMES, SABOTEUR_BRIEF, SCENARIO, SYSTEMS, roleInfo } from "@/game/scenario";
import { Btn, Label, Panel, TextBox, Timer } from "./ui";
import { Briefing, DeductionBoard, RuleCard, Typewriter } from "./Story";
import { sfx } from "./sfx";

// Demo-mode timers (seconds)
export const TIMES = { discussion: 90, interrogation: 45, voting: 30 };

const nameOf = (g: Game, id?: string) => g.state.players.find((p) => p.id === id)?.name ?? "—";

/* ---------------- 1. HOME ---------------- */
export function Home({ g }: { g: Game }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [story, setStory] = useState(false);

  if (story) return <Briefing onDone={() => setStory(false)} />;

  return (
    <div className="space-y-6 text-center">
      <div className="py-6">
        <div className="text-7xl mb-3 eye-pulse">👁</div>
        <h1 className="glitch text-4xl font-black tracking-[0.2em] text-emerald-300" data-text="TRUST NO ONE">TRUST NO ONE</h1>
        <p className="text-emerald-600 mt-3 text-xs tracking-[0.4em]">STATION ASTERIA · 2187</p>
        <p className="text-emerald-700 mt-2 text-sm">One of you is lying. The Oracle is watching.</p>
      </div>
      <button onClick={() => { sfx.click(); setStory(true); }}
        className="w-full py-2 rounded-lg border border-emerald-800 text-emerald-500 text-sm tracking-widest hover:border-emerald-400">
        ▶ PLAY THE STORY
      </button>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="YOUR NAME"
        className="w-full bg-black border border-emerald-700 rounded-lg p-3 text-center tracking-widest" />
      <Btn disabled={!name} onClick={() => { sfx.submit(); g.createRoom(name); }}>Create Game</Btn>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ROOM CODE" maxLength={6}
          className="flex-1 bg-black border border-emerald-700 rounded-lg p-3 text-center tracking-[0.4em] uppercase" />
        <Btn className="!w-28" disabled={!name || code.trim().length !== 6} onClick={() => { sfx.submit(); g.joinRoom(code, name); }}>Join</Btn>
      </div>
      <HowToPlay />
    </div>
  );
}

function HowToPlay() {
  const steps = [
    ["🔎", "Each crew member gets ONE secret piece of evidence about the escape pods."],
    ["🗣", "Share what you know. A pod is safe only if oxygen, navigation and power all work."],
    ["👁", "ORACLE, the station AI, investigates everyone and interrogates suspects."],
    ["😈", "One player is the SABOTEUR, secretly coached by a corrupted AI called SHADOW."],
    ["🚀", "Vote: which pod do you board, and who is the Saboteur?"],
  ];
  return (
    <Panel>
      <Label>How to play</Label>
      <ul className="space-y-2 text-left text-sm">
        {steps.map(([i, t]) => <li key={t} className="flex gap-3"><span>{i}</span><span className="text-emerald-200">{t}</span></li>)}
      </ul>
    </Panel>
  );
}

/* ---------------- 2. LOBBY ---------------- */
export function Lobby({ g }: { g: Game }) {
  const { state } = g;
  const count = state.players.length;
  const mine = state.players.find((p) => p.id === g.me);
  const readyCount = state.players.filter((p) => p.ready).length;
  useEffect(() => { if (count > 0) sfx.join(); }, [count]);
  useEffect(() => { if (readyCount > 0) sfx.ok(); }, [readyCount]);
  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-red-400 text-xs tracking-[0.3em] animate-pulse mb-4">⚠ HULL INTEGRITY FAILING · GATHER YOUR CREW</p>
        <Label>Room code</Label>
        <p className="text-5xl font-black tracking-[0.3em] text-center my-4">{state.roomCode}</p>
        <Label>Crew manifest ({count}/4)</Label>
        <ul className="space-y-2 mb-6">
          {state.players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 fade-up">
              <span className="text-emerald-400">●</span>
              <span className="text-emerald-700 text-xs">CREW-0{i + 1}</span> {p.name}
              <span className={`ml-auto text-[10px] tracking-widest ${p.ready ? "text-emerald-300" : "text-emerald-800"}`}>{p.ready ? "✓ READY" : "NOT READY"}</span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, 4 - count) }).map((_, i) => (
            <li key={i} className="text-emerald-900 animate-pulse">○ awaiting signal…</li>
          ))}
        </ul>
        <Btn onClick={() => { sfx.click(); g.setReady(!mine?.ready); }}>{mine?.ready ? "Cancel ready" : "I'm ready"}</Btn>
        <p className="text-center text-sm my-3 text-emerald-600" role="status">{readyCount}/4 crew ready</p>
        {g.isHost
          ? <Btn disabled={count !== 4 || readyCount !== 4} onClick={() => { sfx.alarm(); g.startGame(); }}>Launch Mission 🚀</Btn>
          : <p className="text-center text-emerald-600">Waiting for the host to launch…</p>}
      </Panel>
    </div>
  );
}

/* ---------------- 3. BRIEFING + PRIVATE EVIDENCE ---------------- */
const briefKey = (room: string) => `tno-briefed-${room}`;

export function Evidence({ g }: { g: Game }) {
  const { state, me } = g;
  const [briefed, setBriefed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(briefKey(state.roomCode)) === "1"; } catch { return false; }
  });
  if (!briefed) {
    return <Briefing onDone={() => {
      try { sessionStorage.setItem(briefKey(state.roomCode), "1"); } catch { /* ignore */ }
      setBriefed(true);
    }} />;
  }
  return <EvidenceFile g={g} isSab={me === state.saboteurId} />;
}

function EvidenceFile({ g, isSab }: { g: Game; isSab: boolean }) {
  const ev = g.state.evidence;
  const mine = g.state.players.find((p) => p.id === g.me);
  const readyCount = g.state.players.filter((p) => p.ready).length;
  const info = roleInfo(ev?.role ?? (isSab ? undefined : g.state.privateRole));
  useEffect(() => { if (isSab) { const t = setTimeout(sfx.glitch, 900); return () => clearTimeout(t); } sfx.ok(); }, [isSab]);

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-[10px] tracking-[0.3em] text-emerald-700">EVIDENCE FILE · DECRYPTED</p>
        <p className="text-2xl font-black mt-1 fade-up">{info.icon} {info.title}</p>
        {info.flavor && <p className="text-emerald-500 text-sm italic mt-1">{info.flavor}</p>}
        <div className="mt-4"><Label>Your private evidence</Label></div>
        {ev?.imageUrl && <EvidenceImage src={ev.imageUrl} />}
        <p className="text-emerald-100 whitespace-pre-line leading-relaxed">
          {ev?.text ? <Typewriter text={ev.text} speed={14} /> : "Decrypting…"}
        </p>
      </Panel>

      {isSab && (
        <Panel glow="red">
          <div className="glitch-box">
            <p className="text-[10px] tracking-[0.4em] text-red-700">▓▓ CLASSIFIED TRANSMISSION ▓▓</p>
            <p className="glitch text-xl font-black text-red-500 mt-1 whitespace-nowrap" data-text="😈 YOU ARE THE SABOTEUR">😈 YOU ARE THE SABOTEUR</p>
            {SABOTEUR_BRIEF.lines.map((l) => <p key={l} className="text-red-200/80 text-sm">{l}</p>)}
            <p className="mt-3 text-red-100 font-bold">{SABOTEUR_BRIEF.mission}</p>
            <p className="text-red-400 text-xs mt-3 tracking-widest">YOU WIN IF:</p>
            {SABOTEUR_BRIEF.winIf.map((l) => <p key={l} className="text-red-200 text-sm">› {l}</p>)}
            <p className="text-red-400 text-xs mt-3 tracking-widest">TACTICS:</p>
            {SABOTEUR_BRIEF.tips.map((l) => <p key={l} className="text-red-200 text-sm">› {l}</p>)}
            <p className="text-red-500/80 text-xs mt-3 italic">Your hidden ally SHADOW will whisper advice during the game. The Oracle is watching you.</p>
          </div>
        </Panel>
      )}

      <RuleCard />
      <p className="text-center text-xs text-red-400 tracking-widest">⚠ DO NOT SHOW THIS SCREEN</p>
      <Btn onClick={() => { sfx.click(); g.setReady(!mine?.ready); }}>
        {mine?.ready ? "Ready — undo" : "I've read my evidence"}
      </Btn>
      <p className="text-center text-sm text-emerald-600" role="status">{readyCount}/4 finished reading. The host can begin discussion once everyone is ready.</p>
    </div>
  );
}

function EvidenceImage({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <div className="relative mb-3 scan-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="security camera evidence" onError={() => setOk(false)}
        className="w-full rounded-lg border border-emerald-800" />
    </div>
  ) : (
    <div className="w-full h-40 rounded-lg border border-dashed border-emerald-800 mb-3 grid place-items-center text-emerald-800">
      [ camera feed lost ]
    </div>
  );
}

/* ---------------- Shadow whisper (Saboteur only) ---------------- */
function ShadowTip({ g }: { g: Game }) {
  const tip = g.state.shadowTip;
  const mine = g.state.privateRole === "saboteur";
  useEffect(() => { if (mine && tip) sfx.shadow(); }, [tip, mine]);
  if (!mine) return null;
  return (
    <Panel glow="red">
      <div className="glitch-box">
        <p className="text-red-500 font-black tracking-widest">😈 SHADOW ADVICE <span className="text-[10px] text-red-800">(only you see this)</span></p>
        {tip && <p className="text-red-200 mt-2 italic"><Typewriter key={tip} text={`“${tip}”`} speed={18} sound={false} /></p>}
      </div>
      <Btn variant="danger" className="mt-3" disabled={Boolean(g.busy)} onClick={() => { sfx.click(); g.runShadow(); }}>
        {g.busy === "Shadow is thinking…" ? "Shadow is thinking…" : tip ? "Ask Shadow again" : "Ask Shadow"}
      </Btn>
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
        <p className="text-emerald-400 font-black flex items-center gap-2"><span className="eye-pulse">👁</span> ORACLE ASKS</p>
        <p className="text-xl mt-2"><Typewriter text="Which escape pod do you believe is safe? What evidence supports your choice?" speed={20} sound={false} /></p>
      </Panel>
      {mine?.answer ? (
        <Panel><Label>Your statement</Label><p>“{mine.answer}”</p></Panel>
      ) : (
        <>
          <TextBox value={text} onChange={setText} placeholder="I think Pod __ because my evidence shows…" />
          <Btn disabled={!text} onClick={() => { sfx.submit(); g.submitAnswer(text); }}>Transmit statement</Btn>
        </>
      )}
      <ShadowTip g={g} />
      <p className="text-center text-emerald-700 text-sm">{answered}/{g.state.players.length} crew have reported</p>
      <AnswersFeed g={g} />
      <DeductionBoard />
    </div>
  );
}

function AnswersFeed({ g }: { g: Game }) {
  const answers = g.state.players.filter((p) => p.answer);
  if (!answers.length) return null;
  return (
    <Panel>
      <Label>Crew comms log</Label>
      <ul className="space-y-2">
        {answers.map((p) => (
          <li key={p.id} className="fade-up">
            <b className="text-emerald-400">{p.name}:</b> {p.answer}
            {p.response && <div className="ml-4 text-amber-200/90 text-sm">↳ to Oracle: {p.response}</div>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------------- 5. ORACLE INTERVENTION ---------------- */
export function Interrogation({ g }: { g: Game }) {
  const [text, setText] = useState("");
  const o = g.state.oracle;
  const q = o?.question;
  useEffect(() => { if (q) sfx.alarm(); }, [q]);
  if (!o) return <OracleThinking />;
  const targeted = g.me === o.interrogate;
  return (
    <div className="space-y-4">
      <Timer seconds={TIMES.interrogation} resetKey="interrogation" />
      <div className="shake-once">
        <Panel glow="amber">
          <p className="text-amber-400 font-black text-xl animate-pulse">🚨 ORACLE INTERVENTION</p>
          <p className="text-amber-300 text-sm mt-1 tracking-widest">{nameOf(g, o.interrogate).toUpperCase()}</p>
          <p className="mt-3 text-amber-100 text-lg"><Typewriter text={o.question} speed={22} /></p>
          {o.reason && <p className="mt-3 text-amber-500/80 text-xs">ORACLE ANALYSIS: {o.reason}</p>}
          <div className="mt-3">
            <div className="flex justify-between text-[10px] tracking-widest text-amber-600"><span>SUSPICION · {nameOf(g, o.suspect)}</span><span>{o.confidence}%</span></div>
            <div className="h-2 bg-zinc-900 rounded mt-1 overflow-hidden"><div className="h-full bg-amber-500 grow-bar" style={{ width: `${o.confidence}%` }} /></div>
          </div>
        </Panel>
      </div>
      {targeted && !g.state.interrogationResponse && (
        <>
          <p className="text-red-400 text-sm text-center animate-pulse">The Oracle is asking YOU. Defend yourself.</p>
          <TextBox value={text} onChange={setText} placeholder="Defend yourself…" />
          <Btn onClick={() => { sfx.submit(); g.submitInterrogation(text); }} disabled={!text}>Respond</Btn>
        </>
      )}
      {g.state.interrogationResponse && (
        <Panel><Label>{nameOf(g, o.interrogate)} responds</Label><p className="fade-up">“{g.state.interrogationResponse}”</p></Panel>
      )}
      <ShadowTip g={g} />
      <AnswersFeed g={g} />
      <DeductionBoard />
    </div>
  );
}

function OracleThinking() {
  return (
    <Panel>
      <div className="text-center py-10">
        <div className="text-6xl eye-pulse">👁</div>
        <p className="mt-4 tracking-widest text-emerald-400">ORACLE IS ANALYZING EVIDENCE…</p>
        <p className="mt-2 text-emerald-700 text-xs">Cross-referencing statements · inspecting camera footage</p>
      </div>
    </Panel>
  );
}

/* ---------------- 6. VOTING ---------------- */
export function Voting({ g }: { g: Game }) {
  const [sab, setSab] = useState("");
  const [pod, setPod] = useState<Pod | "">("");
  const mine = g.state.players.find((p) => p.id === g.me);
  if (mine?.vote || mine?.voted) {
    return (
      <div className="space-y-4"><Panel>
        <div className="text-center py-8">
          <p className="tracking-widest">🔒 DECISION LOCKED</p>
          <p className="text-emerald-700 text-sm mt-2">Waiting for the crew… Oracle is making its own prediction.</p>
          <div className="text-4xl mt-4 eye-pulse">👁</div>
        </div>
      </Panel><ShadowTip g={g} /></div>
    );
  }
  return (
    <div className="space-y-4">
      <ShadowTip g={g} />
      <Timer seconds={TIMES.voting} resetKey="voting" />
      <p className="text-center text-red-400 font-black tracking-[0.2em] animate-pulse">MAKE YOUR FINAL DECISION</p>
      <Panel>
        <Label>Which pod do you board?</Label>
        <div className="grid grid-cols-4 gap-2">
          {SCENARIO.pods.map((x) => (
            <Choice key={x} on={pod === x} onClick={() => { sfx.click(); setPod(x); }}>
              <div className="text-2xl">{x}</div><div className="text-[9px] tracking-widest opacity-70">{POD_NAMES[x]}</div>
            </Choice>
          ))}
        </div>
      </Panel>
      <Panel>
        <Label>Who is the Saboteur?</Label>
        <div className="grid grid-cols-2 gap-2">
          {g.state.players.filter((p) => p.id !== g.me).map((p) => (
            <Choice key={p.id} on={sab === p.id} onClick={() => { sfx.click(); setSab(p.id); }}>{p.name}</Choice>
          ))}
        </div>
      </Panel>
      <Btn variant="danger" disabled={!sab || !pod} onClick={() => { sfx.drum(); g.submitVote(sab, pod as Pod); }}>Lock in</Btn>
      <DeductionBoard />
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`py-3 rounded-lg border font-bold transition ${on ? "bg-emerald-500 text-black border-emerald-300 scale-105" : "border-emerald-800 hover:border-emerald-500"}`}>
      {children}
    </button>
  );
}

/* ---------------- 7. REVEAL ---------------- */
// step: 0 sequence · 1 pod · 2-4 systems · 5 outcome · 6 saboteur · 7 humans vs oracle · 8 verdict
export function Result({ g }: { g: Game }) {
  const [step, setStep] = useState(0);
  const { state } = g;
  const result = state.result;
  const tied = Boolean(result?.tiedPodVote) || !result?.chosenPods.length;
  const pod = (tied ? undefined : result?.chosenPods[0]) as Pod | undefined;
  const failing = pod ? POD_FAILURE[pod] : null;
  const survived = Boolean(result?.survived);
  const crewSus = result?.suspects.length === 1 ? result.suspects[0] : undefined;
  const humansRight = Boolean(result?.humansCorrect);
  const oracleRight = Boolean(result?.oracleCorrect);

  useEffect(() => {
    if (step > 8) return;
    // sound for the step that just appeared
    if (step === 0) sfx.whoosh();
    else if (step === 1) sfx.drum();
    else if (step >= 2 && step <= 4) {
      const sys = SYSTEMS[step - 2];
      if (pod && failing === sys) sfx.bad(); else if (pod) sfx.ok();
    } else if (step === 5) { if (survived) sfx.success(); else sfx.explosion(); }
    else if (step === 6) sfx.glitch();
    else if (step === 7) sfx.drum();
    else if (step === 8) { if (humansRight || oracleRight) sfx.oracle(); else sfx.shadow(); }
    const delay = step === 0 ? 1600 : step === 5 ? 2200 : step === 6 ? 2000 : 1300;
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const verdict =
    humansRight && !oracleRight ? "🧠 HUMANS OUTSMARTED THE AI" :
    !humansRight && oracleRight ? "👁 ORACLE SAW THROUGH THE DECEPTION" :
    humansRight && oracleRight ? "🤝 HUMANS AND ORACLE EXPOSED THE SABOTEUR" :
    "😈 THE SABOTEUR ESCAPED. SHADOW WINS.";

  return (
    <div className={`space-y-4 text-center ${step === 5 && !survived ? "shake-once" : ""}`}>
      <Panel glow={step >= 5 ? (survived ? "green" : "red") : "green"}>
        <p className="text-xs tracking-[0.4em] text-emerald-600">
          <Typewriter text={tied ? "CREW COULD NOT AGREE…" : "ESCAPE SEQUENCE INITIATED…"} speed={40} />
        </p>
        {step >= 1 && (
          <p className="text-5xl font-black mt-3 fade-up">
            {pod ? <>🚀 POD {pod}<span className="block text-sm tracking-[0.4em] text-emerald-500 mt-1">{POD_NAMES[pod]}</span></>
              : <span className="text-red-500 text-3xl">NO POD SELECTED<span className="block text-sm text-red-300 mt-1">Tie: {result?.chosenPods.join(" / ") || "no votes"}</span></span>}
          </p>
        )}
        {pod && (
          <div className="mt-4 space-y-1 font-mono text-left max-w-xs mx-auto">
            {SYSTEMS.map((s, i) => step >= i + 2 && (
              <p key={s} className={`fade-up flex justify-between ${failing === s ? "text-red-500 font-black" : "text-emerald-300"}`}>
                <span>{s}</span><span className="flex-1 border-b border-dotted border-emerald-900 mx-2 mb-1" />
                <span>{failing === s ? "OFFLINE ✗" : "ONLINE ✓"}</span>
              </p>
            ))}
          </div>
        )}
        {step >= 5 && (
          survived
            ? <p className="text-3xl font-black text-emerald-400 mt-4 fade-up">🚀 ESCAPE SUCCESSFUL</p>
            : <p className="text-3xl font-black text-red-500 mt-4 fade-up">💥 {pod ? "LAUNCH FAILED" : "THE STATION WAS LOST"}</p>
        )}
      </Panel>

      {step >= 6 && (
        <Panel glow="red">
          <p className="text-xs tracking-[0.4em] text-red-700">SABOTEUR IDENTIFIED…</p>
          <p className="glitch text-4xl font-black text-red-500 mt-2" data-text={`😈 ${nameOf(g, result?.saboteurId)}`}>😈 {nameOf(g, result?.saboteurId)}</p>
        </Panel>
      )}

      {step >= 7 && (
        <Panel>
          <div className="grid grid-cols-2 gap-4 fade-up">
            <div>
              <Label>Humans suspected</Label>
              <p className="text-xl font-bold">{result?.tiedSuspectVote ? "Tie: " + result.suspects.map((id) => nameOf(g, id)).join(" / ") : nameOf(g, crewSus)} {humansRight ? "✅" : "❌"}</p>
            </div>
            <div>
              <Label>Oracle suspected</Label>
              <p className="text-xl font-bold">{nameOf(g, state.oracleVote?.saboteur)} {oracleRight ? "✅" : "❌"}</p>
            </div>
          </div>
          {result?.oracleVote?.reason && <p className="text-emerald-600 text-xs mt-3 italic">👁 “{result.oracleVote.reason}”</p>}
        </Panel>
      )}

      {step >= 8 && <p className="text-3xl font-black tracking-wide fade-up verdict-glow">{verdict}</p>}
    </div>
  );
}
