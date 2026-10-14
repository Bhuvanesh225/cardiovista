import { useState } from "react";
import { VESSEL_CONFIG } from "../lib/vesselConfig";
import { useRiskStore } from "../lib/store";
import { HeartScene } from "./HeartScene";
import type { HeadName } from "../lib/types";

type VesselHead = "lad" | "lcx" | "rca";

export function ViewerPanel() {
  const probs = useRiskStore((s) => s.probs);
  const selected = useRiskStore((s) => s.selected);
  const select = useRiskStore((s) => s.select);
  const bpm = useRiskStore((s) => Number(s.inputs.PR) || 78);
  const [isolate, setIsolate] = useState<VesselHead | "all">("all");
  const [explode, setExplode] = useState(0);
  const [focus, setFocus] = useState<VesselHead | null>(null);

  const isolateVessel = (v: VesselHead | "all") => {
    setIsolate(v);
    setFocus(v === "all" ? null : v);
  };

  return (
    <section
      aria-label="Anatomical risk map"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-panel lg:h-full"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
          Anatomical risk map
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
            Explode
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(explode * 100)}
              onChange={(e) => setExplode(Number(e.target.value) / 100)}
              aria-label="Exploded view amount"
              data-testid="explode"
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-surface-raised accent-primary"
            />
            <span className="w-9 tabular-nums text-white">{Math.round(explode * 100)}%</span>
          </label>
          {focus ? (
            <button
              type="button"
              onClick={() => setFocus(null)}
              data-testid="reset-view"
              className="rounded-lg border border-primary bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/25"
            >
              Reset view
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-[320px] flex-1 overflow-hidden sm:min-h-[420px] lg:min-h-0">
        <HeartScene
          probs={probs}
          selected={selected}
          isolate={isolate}
          bpm={bpm}
          explode={explode}
          focus={focus}
          onSelectVessel={(h: HeadName) => {
            if (h !== "cad") select(h);
          }}
          onFocusVessel={setFocus}
          onBackgroundClick={() => setFocus(null)}
        />
        {!probs ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-max rounded-full border border-line bg-black/60 px-3 py-1 text-[11px] font-semibold text-muted backdrop-blur">
            Run a prediction to colour the coronaries
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Isolate</span>
          <div role="group" aria-label="Isolate vessel" className="flex gap-1">
            <Chip active={isolate === "all"} onClick={() => isolateVessel("all")}>
              All
            </Chip>
            {VESSEL_CONFIG.map((v, i) => (
              <Chip key={v.head} active={isolate === v.head} onClick={() => isolateVessel(v.head)}>
                <span className="mr-1 inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-surface-raised text-[8px] font-extrabold text-slate-300">
                  {i + 1}
                </span>
                {v.label}
              </Chip>
            ))}
          </div>
        </div>
        <Legend />
      </div>
      <p className="border-t border-line px-4 py-2 text-[10.5px] text-muted">
        Drag to orbit · scroll to zoom · click a coronary to select · double-click to focus ·
        click empty space to reset · the beat follows the patient&apos;s pulse.
      </p>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10.5px] font-semibold text-muted" aria-label="Risk legend">
      <span className="flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-full bg-success" /> &lt;30%
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-full bg-warning" /> 30–60%
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-full bg-error" /> &gt;60%
      </span>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
        active ? "border-primary bg-primary/15 text-primary" : "border-line bg-surface-container text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
