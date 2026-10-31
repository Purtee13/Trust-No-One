"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/useGame";
import { Home, Lobby, Evidence, Discussion, Interrogation, Voting, Result } from "@/components/Screens";
import { isMuted, setMuted, sfx, unlockAudio } from "@/components/sfx";

const PHASE_LABEL: Record<string, string> = {
  lobby: "DOCKING BAY", evidence: "EVIDENCE", discussion: "DISCUSSION",
  interrogation: "INTERROGATION", voting: "FINAL VOTE", result: "ESCAPE",
};

export default function Page() {
  const g = useGame();
  const { phase } = g.state;
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMutedState(isMuted()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (phase !== "home") sfx.whoosh(); }, [phase]);

  const red = phase === "interrogation" || phase === "voting";
  return (
    <main onPointerDown={unlockAudio}
      className={`relative min-h-dvh w-full bg-black text-emerald-300 font-mono px-3 sm:px-4 py-5 pb-28 overflow-x-clip break-words ${red ? "red-alert" : ""}`}>
      <div className="starfield" aria-hidden />
      <div className="scanlines" aria-hidden />
      <div className="relative mx-auto w-full max-w-md min-w-0">
        <div className="flex justify-between items-center gap-2 text-[10px] sm:text-xs text-emerald-700 mb-4 tracking-widest">
          <span>{phase !== "home" ? `👁 ${PHASE_LABEL[phase]}` : ""}</span>
          <span className="flex items-center gap-3">
            {phase !== "home" && <span>ROOM {g.state.roomCode}</span>}
            <button aria-label={muted ? "Unmute" : "Mute"} className="text-base"
              onClick={() => { setMuted(!muted); setMutedState(!muted); }}>
              {muted ? "🔇" : "🔊"}
            </button>
          </span>
        </div>
        {g.error && <div role="alert" className="border border-red-500 text-red-300 p-3 mb-4">{g.error}<button className="ml-3 underline" onClick={g.clearError}>Dismiss</button></div>}
        {g.busy && <p role="status" className="text-amber-300 mb-4 animate-pulse">{g.busy} This may take a minute.</p>}
        <fieldset disabled={Boolean(g.busy)} className="space-y-4 min-w-0 w-full">
          {phase === "home" && <Home g={g} />}
          {phase === "lobby" && <Lobby g={g} />}
          {phase === "evidence" && <Evidence g={g} />}
          {phase === "discussion" && <Discussion g={g} />}
          {phase === "interrogation" && <Interrogation g={g} />}
          {phase === "voting" && <Voting g={g} />}
          {phase === "result" && <Result g={g} />}
        </fieldset>
        {phase !== "home" && <button className="mt-6 text-xs underline text-emerald-700" onClick={g.leave}>Return home (seat stays reserved)</button>}
      </div>
      <HostControls g={g} />
    </main>
  );
}

function HostControls({ g }: { g: ReturnType<typeof useGame> }) {
  if (!g.isHost || ["home", "lobby", "result"].includes(g.state.phase)) return null;
  const phase = g.state.phase;
  const ready = (phase === "evidence" && g.state.players.length === 4 && g.state.players.every(p => p.ready)) ||
    (phase === "discussion" && g.state.players.every(p => p.answer)) ||
    (phase === "interrogation" && Boolean(g.state.interrogationResponse)) ||
    (phase === "voting" && g.state.players.every(p => p.voted));
  return <div className="fixed bottom-0 inset-x-0 z-20 bg-zinc-950/95 border-t border-emerald-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2 justify-center items-center text-sm">
    <span className="self-center text-[10px] tracking-widest text-emerald-700">HOST</span>
    <button disabled={!ready || Boolean(g.busy)} className="bg-emerald-500 text-black p-2 rounded font-bold disabled:opacity-40"
      onClick={() => { sfx.click(); (phase === "discussion" ? g.runOracle : phase === "voting" ? g.reveal : g.next)(); }}>
      {phase === "discussion" ? "👁 Run Oracle + interrogate" : phase === "voting" ? "👁 Oracle vote + reveal" : phase === "evidence" ? "Begin discussion" : "Open voting"}
    </button>
  </div>;
}
