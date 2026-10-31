"use client";
import { useGame, PHASES } from "@/lib/useGame";
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
        {phase === "home" && <Home g={g} />}
        {phase === "lobby" && <Lobby g={g} />}
        {phase === "evidence" && <Evidence g={g} />}
        {phase === "discussion" && <Discussion g={g} />}
        {phase === "interrogation" && <Interrogation g={g} />}
        {phase === "voting" && <Voting g={g} />}
        {phase === "result" && <Result g={g} />}
      </div>
      <DevBar g={g} />
    </main>
  );
}

// Dev toolbar: switch which player you're viewing as + jump phases. Remove before demo.
function DevBar({ g }: { g: ReturnType<typeof useGame> }) {
  if (g.state.phase === "home") return null;
  return (
    <div className="fixed bottom-0 inset-x-0 bg-zinc-900/95 border-t border-zinc-700 p-2 text-xs text-zinc-300 flex flex-wrap gap-2 justify-center">
      <span>VIEW AS:</span>
      {g.state.players.map((p) => (
        <button key={p.id} onClick={() => g.setMe(p.id)}
          className={`px-2 rounded ${g.me === p.id ? "bg-emerald-600 text-black" : "bg-zinc-700"}`}>
          {p.name}{p.id === g.state.saboteurId ? " 😈" : ""}
        </button>
      ))}
      <span className="ml-2">PHASE:</span>
      <button className="px-2 rounded bg-amber-600 text-black" onClick={g.runOracle}>Run Oracle</button>
      <button className="px-2 rounded bg-zinc-700" onClick={g.next}>Next ▶ ({PHASES.indexOf(g.state.phase)})</button>
    </div>
  );
}
