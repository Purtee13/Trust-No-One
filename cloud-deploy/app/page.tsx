"use client";
import { useGame } from "@/lib/useGame";
import { Home, Lobby, Evidence, Discussion, Interrogation, Voting, Result } from "@/components/Screens";

export default function Page() {
  const g = useGame();
  const { phase } = g.state;
  return (
    <main className="min-h-screen bg-black text-emerald-300 font-mono px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md">
        {phase !== "home" && (
          <div className="flex justify-between text-xs text-emerald-700 mb-4 tracking-widest">
            <span>👁 TRUST NO ONE</span><span>ROOM {g.state.roomCode}</span>
          </div>
        )}
        {g.error && <div role="alert" className="border border-red-500 text-red-300 p-3 mb-4">{g.error}<button className="ml-3 underline" onClick={g.clearError}>Dismiss</button></div>}
        {g.busy && <p role="status" className="text-amber-300 mb-4">{g.busy} This may take a minute.</p>}
        <fieldset disabled={Boolean(g.busy)} className="space-y-4">
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
  return <div className="fixed bottom-0 inset-x-0 bg-zinc-900 border-t border-emerald-800 p-3 flex gap-3 justify-center text-sm">
    <button disabled={!ready || Boolean(g.busy)} className="bg-emerald-500 text-black p-2 rounded disabled:opacity-40"
      onClick={phase === "discussion" ? g.runOracle : phase === "voting" ? g.reveal : g.next}>
      {phase === "discussion" ? "Run Oracle + interrogate" : phase === "voting" ? "Oracle vote + reveal" : phase === "evidence" ? "Begin discussion" : "Open voting"}
    </button>
    {["discussion", "interrogation", "voting"].includes(phase) && <button disabled={Boolean(g.busy)} className="border border-red-700 text-red-300 p-2 rounded disabled:opacity-40" onClick={g.runShadow}>Update Shadow advice</button>}
  </div>;
}
