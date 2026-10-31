"use client";
import { useEffect, useState } from "react";
import type { Pod } from "@/lib/types";
import { BRIEFING, POD_NAMES, RULE, SCENARIO, SYSTEMS } from "@/game/scenario";
import { sfx } from "./sfx";
import { Btn, Panel } from "./ui";

/* ---------------- Typewriter ---------------- */
export function Typewriter({ text, speed = 26, onDone, sound = true, className = "" }: {
  text: string; speed?: number; onDone?: () => void; sound?: boolean; className?: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      const t = setTimeout(() => onDone?.(), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setN((x) => x + 1);
      if (sound && n % 2 === 0 && text[n] !== " ") sfx.type();
    }, speed);
    return () => clearTimeout(t);
  }, [n, text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="caret">▌</span>}
    </span>
  );
}

/* ---------------- Opening cinematic ---------------- */
export function Briefing({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const [i, setI] = useState(0);
  const finished = i >= BRIEFING.length;

  useEffect(() => {
    const tone = BRIEFING[i]?.tone;
    if (i === 2) sfx.explosion();
    else if (tone === "alert") sfx.alarm();
  }, [i]);

  return (
    <div className={`space-y-4 ${compact ? "" : "min-h-[70vh]"} ${i >= 2 && i <= 3 ? "shake-once" : ""}`}>
      <p className="text-xs tracking-[0.4em] text-emerald-700">▶ INCOMING TRANSMISSION · STATION ASTERIA</p>
      {BRIEFING.slice(0, Math.min(i + 1, BRIEFING.length)).map((line, k) => {
        const cls =
          line.tone === "big" ? "text-3xl font-black text-emerald-200 tracking-wide" :
          line.tone === "alert" ? "text-lg font-bold text-red-400" :
          line.tone === "dim" ? "text-emerald-500 italic" :
          "text-lg text-emerald-100";
        return (
          <div key={k} className="fade-up">
            {k < i ? <p className={cls}>{line.text}</p> : (
              <p className={cls}><Typewriter text={line.text} speed={line.tone === "big" ? 55 : 22} onDone={() => setI((x) => x + 1)} /></p>
            )}
            {line.tone === "pods" && (k < i || finished) && <PodGrid />}
          </div>
        );
      })}
      <div className="flex gap-3 pt-4">
        {!finished && (
          <button onClick={() => setI(BRIEFING.length)} className="flex-1 py-3 rounded-lg border border-emerald-800 text-emerald-600 tracking-widest text-sm hover:border-emerald-500">
            SKIP ▶▶
          </button>
        )}
        {finished && <Btn onClick={() => { sfx.submit(); onDone(); }}>Accept mission</Btn>}
      </div>
    </div>
  );
}

function PodGrid() {
  return (
    <div className="grid grid-cols-4 gap-2 mt-3">
      {SCENARIO.pods.map((p, k) => (
        <div key={p} className="pod-card fade-up" style={{ animationDelay: `${k * 120}ms` }}>
          <div className="text-3xl font-black">{p}</div>
          <div className="text-[10px] tracking-widest text-emerald-500">{POD_NAMES[p]}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Rules card ---------------- */
export function RuleCard() {
  return (
    <Panel>
      <p className="text-xs tracking-[0.3em] text-emerald-600 mb-2">SAFE POD CHECKLIST</p>
      <div className="flex justify-around text-center my-2">
        {["🫁 OXYGEN", "📡 NAVIGATION", "⚡ POWER"].map((s) => <span key={s} className="text-sm font-bold">{s} ✓</span>)}
      </div>
      <p className="text-emerald-300/80 text-sm">{RULE}</p>
      <p className="text-emerald-700 text-xs mt-2">No single player knows the full answer. Share your evidence.</p>
    </Panel>
  );
}

/* ---------------- Personal deduction board (local only) ---------------- */
type Mark = "?" | "✓" | "✗";
const NEXT: Record<Mark, Mark> = { "?": "✓", "✓": "✗", "✗": "?" };

export function DeductionBoard() {
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const get = (p: Pod, s: string) => marks[`${p}-${s}`] ?? "?";
  const flip = (p: Pod, s: string) => { sfx.click(); setMarks((m) => ({ ...m, [`${p}-${s}`]: NEXT[get(p, s)] })); };
  const verdict = (p: Pod) => {
    const v = SYSTEMS.map((s) => get(p, s));
    return v.includes("✗") ? "✗" : v.every((x) => x === "✓") ? "✓" : "?";
  };
  return (
    <Panel>
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between text-sm tracking-widest text-emerald-400">
        <span>📋 MY DEDUCTION BOARD</span><span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 fade-up">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="text-emerald-700 text-[10px] tracking-widest">
                <th className="text-left">POD</th><th>⚡ PWR</th><th>📡 NAV</th><th>🫁 O₂</th><th>SAFE?</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIO.pods.map((p) => (
                <tr key={p}>
                  <td className="text-left py-1 font-bold">{p} <span className="text-[9px] text-emerald-700">{POD_NAMES[p]}</span></td>
                  {SYSTEMS.map((s) => {
                    const m = get(p, s);
                    return (
                      <td key={s}>
                        <button onClick={() => flip(p, s)}
                          className={`w-9 h-8 rounded border ${m === "✓" ? "border-emerald-400 text-emerald-300" : m === "✗" ? "border-red-500 text-red-400" : "border-emerald-900 text-emerald-800"}`}>
                          {m}
                        </button>
                      </td>
                    );
                  })}
                  <td className={verdict(p) === "✓" ? "text-emerald-300 font-black" : verdict(p) === "✗" ? "text-red-500" : "text-emerald-800"}>{verdict(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-emerald-700 mt-2">Tap a cell to mark ? → ✓ → ✗. Only you can see this.</p>
        </div>
      )}
    </Panel>
  );
}
