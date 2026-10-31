"use client";
import { useEffect, useState } from "react";

export function Panel({ children, glow = "green" }: { children: React.ReactNode; glow?: "green" | "red" | "amber" }) {
  const c = {
    green: "border-emerald-500/60 shadow-[0_0_24px_rgba(16,185,129,0.25)]",
    red: "border-red-500/70 shadow-[0_0_28px_rgba(239,68,68,0.35)]",
    amber: "border-amber-400/70 shadow-[0_0_28px_rgba(251,191,36,0.3)]",
  }[glow];
  return <div className={`border rounded-xl p-5 bg-zinc-950/80 ${c}`}>{children}</div>;
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "go" | "danger" }) {
  const { variant = "go", className = "", ...rest } = props;
  const v = variant === "danger"
    ? "bg-red-600 hover:bg-red-500 text-white"
    : "bg-emerald-500 hover:bg-emerald-400 text-black";
  return (
    <button
      {...rest}
      className={`w-full py-3 rounded-lg font-bold tracking-widest uppercase transition disabled:opacity-40 ${v} ${className}`}
    />
  );
}

export function TextBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full bg-black border border-emerald-700 rounded-lg p-3 text-emerald-100 placeholder:text-emerald-900 focus:outline-none focus:border-emerald-400"
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs tracking-[0.3em] text-emerald-600 uppercase mb-2">{children}</p>;
}

// Countdown that restarts whenever `resetKey` changes
export function Timer({ seconds, resetKey, onDone }: { seconds: number; resetKey: string; onDone?: () => void }) {
  const [left, setLeft] = useState(seconds);
  void resetKey; // timer restarts because each screen remounts
  useEffect(() => {
    if (left <= 0) { onDone?.(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  const urgent = left <= 10;
  return (
    <div className={`text-right font-bold tabular-nums ${urgent ? "text-red-500 animate-pulse" : "text-emerald-400"}`}>
      ⏱ {Math.floor(left / 60)}:{String(Math.max(left, 0) % 60).padStart(2, "0")}
    </div>
  );
}
