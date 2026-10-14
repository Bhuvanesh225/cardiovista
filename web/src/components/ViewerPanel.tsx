import { useState } from "react";
import { ORIENTATION_PRESETS, VESSEL_CONFIG } from "../lib/vesselConfig";
import { useRiskStore } from "../lib/store";
import { HeartScene } from "./HeartScene";
import type { HeadName } from "../lib/types";

type VesselHead = "lad" | "lcx" | "rca";

export function ViewerPanel() {
  const probs = useRiskStore((s) => s.probs);
  const selected = useRiskStore((s) => s.selected);
  const select = useRiskStore((s) => s.select);
  const [isolate, setIsolate] = useState<VesselHead | "all">("all");
  const [xray, setXray] = useState(false);
  const [orientation, setOrientation] = useState("anterior");
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <section
      aria-label="Anatomical risk map"
      className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-panel"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
          Anatomical risk map
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Camera orientation" className="flex rounded-lg border border-line bg-surface-container p-0.5">
            {Object.entries(ORIENTATION_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOrientation(id)}
                aria-pressed={orientation === id}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  orientation === id ? "bg-primary/20 text-primary" : "text-muted hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Toggle active={xray} onClick={() => setXray((v) => !v)} label="X-ray" testid="toggle-xray" />
          <Toggle active={autoRotate} onClick={() => setAutoRotate((v) => !v)} label="Spin" />
        </div>
      </header>

      <div className="relative min-h-[320px] flex-1 overflow-hidden sm:min-h-[420px] lg:min-h-0">
        <HeartScene
          probs={probs}
          selected={selected}
          isolate={isolate}
          xray={xray}
          orientation={orientation}
          autoRotate={autoRotate}
          onSelectVessel={(h: HeadName) => {
            if (h !== "cad") select(h);
          }}
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
            <Chip active={isolate === "all"} onClick={() => setIsolate("all")}>
              All
            </Chip>
            {VESSEL_CONFIG.map((v, i) => (
              <Chip key={v.head} active={isolate === v.head} onClick={() => setIsolate(v.head)}>
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
        Drag to orbit · scroll to zoom · click a coronary or its label to sync with the risk bars.
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

function Toggle({
  active,
  onClick,
  label,
  testid,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  testid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testid}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
        active ? "border-primary bg-primary/15 text-primary" : "border-line bg-surface-container text-muted hover:text-white"
      }`}
    >
      {label}
    </button>
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