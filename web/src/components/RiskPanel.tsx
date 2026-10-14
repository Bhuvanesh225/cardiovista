import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { bandColor, VESSEL_META } from "../lib/types";
import type { CounterfactualResponse, HeadName, HeadProb, Probs } from "../lib/types";
import { useRiskStore } from "../lib/store";

export function RiskPanel() {
  const probs = useRiskStore((s) => s.probs);
  const ood = useRiskStore((s) => s.ood);
  const selected = useRiskStore((s) => s.selected);
  const select = useRiskStore((s) => s.select);
  const explain = useRiskStore((s) => s.explain);
  const latency = useRiskStore((s) => s.latencyMs);

  return (
    <section
      aria-label="Risk and explainability"
      className="flex min-h-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-panel lg:h-full lg:overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
          Risk &amp; explainability
        </h2>
        {ood ? (
          <span
            data-testid="ood-badge"
            className="rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning"
          >
            OOD-review
          </span>
        ) : null}
      </div>

      <HeroBadge probs={probs} latency={latency} />

      <VesselBars probs={probs} selected={selected} onSelect={(h) => { select(h); explain(h); }} />

      <ShapPanel />
      <CounterfactualCard />
    </section>
  );
}

function HeroBadge({ probs, latency }: { probs: Probs | null; latency: number | null }) {
  const cad = probs?.cad;
  const p = cad?.p ?? 0;
  const color = cad ? bandColor(p) : "#8A94A6";
  return (
    <div className="rounded-xl border border-line bg-surface-container p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Coronary artery disease
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tabular text-[42px] font-extrabold leading-none text-white">
              {cad ? p.toFixed(2) : "—.—"}
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide"
              style={{ color, backgroundColor: `${color}22` }}
            >
              {cad ? cad.flag : "idle"}
            </span>
          </div>
        </div>
        {latency !== null ? (
          <span className="text-[10px] font-semibold text-muted">{latency.toFixed(0)} ms</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>
          95% CI{" "}
          <strong className="tabular text-slate-300">
            {cad ? `${cad.ci[0].toFixed(2)}–${cad.ci[1].toFixed(2)}` : "—"}
          </strong>
        </span>
        <span>
          Youden thr <strong className="tabular text-slate-300">{cad ? cad.threshold.toFixed(2) : "—"}</strong>
        </span>
        <span>
          cal <strong className="text-slate-300">{cad?.calibration ?? "—"}</strong>
        </span>
      </div>
    </div>
  );
}

function VesselBars({
  probs,
  selected,
  onSelect,
}: {
  probs: Probs | null;
  selected: HeadName;
  onSelect: (h: HeadName) => void;
}) {
  const vessels: ("lad" | "lcx" | "rca")[] = ["lad", "lcx", "rca"];
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        Per-vessel stenosis ≥50%
      </div>
      {vessels.map((v) => {
        const hp = probs?.[v];
        return (
          <VesselBar
            key={v}
            head={v}
            hp={hp}
            selected={selected === v}
            onClick={() => onSelect(v)}
          />
        );
      })}
    </div>
  );
}

function VesselBar({
  head,
  hp,
  selected,
  onClick,
}: {
  head: "lad" | "lcx" | "rca";
  hp?: HeadProb;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = VESSEL_META[head];
  const p = hp?.p ?? 0;
  const color = hp ? bandColor(p) : "#8A94A6";
  const thr = hp?.threshold ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`vessel-${head}`}
      aria-pressed={selected}
      className={`w-full rounded-lg border p-2.5 text-left transition ${
        selected ? "border-primary/60 bg-primary/5" : "border-line bg-surface-container hover:border-line/80"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-200">
          {meta.name}
          <span className="ml-1.5 text-[10px] font-medium text-muted">{meta.full}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular text-[12px] font-bold text-white">
            {hp ? p.toFixed(2) : "—"}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase"
            style={{ color, backgroundColor: `${color}22` }}
          >
            {hp ? hp.flag : "—"}
          </span>
        </span>
      </div>
      <div className="relative mt-2 h-2 w-full rounded-full bg-surface-raised">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${p * 100}%`, backgroundColor: color }}
        />
        {/* CI whisker */}
        {hp ? (
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 border-x border-white/60"
            style={{ left: `${hp.ci[0] * 100}%`, width: `${(hp.ci[1] - hp.ci[0]) * 100}%` }}
            aria-hidden
          />
        ) : null}
        {/* Youden threshold tick */}
        {hp ? (
          <div
            className="absolute -top-1 h-4 w-0.5 bg-white"
            style={{ left: `${thr * 100}%` }}
            title={`Youden threshold ${thr.toFixed(2)}`}
          />
        ) : null}
      </div>
    </button>
  );
}

function ShapPanel() {
  const shap = useRiskStore((s) => s.shap);
  const selected = useRiskStore((s) => s.selected);
  const explain = useRiskStore((s) => s.explain);
  const tabs: HeadName[] = ["cad", "lad", "lcx", "rca"];

  const maxAbs = useMemo(
    () => Math.max(0.01, ...(shap?.values.map((v) => Math.abs(v.shap)) ?? [0.01])),
    [shap],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          TreeSHAP waterfall
        </div>
        <div role="tablist" aria-label="SHAP target" className="flex gap-0.5 rounded-lg border border-line bg-surface-container p-0.5">
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={selected === t}
              onClick={() => explain(t)}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase transition ${
                selected === t ? "bg-primary/20 text-primary" : "text-muted hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!shap ? (
        <p className="rounded-lg border border-line bg-surface-container p-3 text-[11.5px] text-muted">
          Run a prediction to see which findings drove the estimate.
        </p>
      ) : (
        <div className="rounded-lg border border-line bg-surface-container p-3">
          <div className="mb-2 flex items-center justify-between text-[10.5px] text-muted">
            <span>
              base value <strong className="tabular text-slate-300">{shap.base_value.toFixed(2)}</strong>
            </span>
            <span className="text-muted">±contribution (log-odds)</span>
          </div>
          <div className="space-y-1.5">
            {shap.values.map((v) => {
              const w = (Math.abs(v.shap) / maxAbs) * 50;
              const positive = v.shap >= 0;
              return (
                <div key={v.feature} className="flex items-center gap-2">
                  <span className="w-[116px] shrink-0 truncate text-[11px] font-semibold text-slate-300" title={v.feature}>
                    {v.feature}
                  </span>
                  <div className="relative h-3.5 flex-1">
                    <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                    <div
                      className="absolute top-0.5 h-2.5 rounded-sm"
                      style={{
                        left: positive ? "50%" : `calc(50% - ${w}%)`,
                        width: `${w}%`,
                        backgroundColor: positive ? "#FB2C36" : "#2B7FFF",
                      }}
                    />
                  </div>
                  <span className="tabular w-11 shrink-0 text-right text-[10.5px] font-bold text-slate-200">
                    {v.shap >= 0 ? "+" : ""}
                    {v.shap.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CounterfactualCard() {
  const inputs = useRiskStore((s) => s.inputs);
  const probs = useRiskStore((s) => s.probs);
  const selected = useRiskStore((s) => s.selected);
  const [mods, setMods] = useState<Record<string, number>>({ BP: 120, "Current Smoker": 0 });
  const [result, setResult] = useState<CounterfactualResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const enabled = !!probs;

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const res = await api.counterfactual(inputs, mods, selected);
        setResult(res);
      } catch {
        setResult(null);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [inputs, mods, selected, enabled]);

  if (!enabled) return null;

  const delta = result?.deltas[selected];
  return (
    <div className="space-y-2" data-testid="counterfactual">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        Live counterfactual
      </div>
      <div className="space-y-2.5 rounded-lg border border-line bg-surface-container p-3">
        <ModSlider
          label="Systolic BP"
          min={90}
          max={200}
          value={mods.BP}
          onChange={(v) => setMods((m) => ({ ...m, BP: v }))}
          unit="mmHg"
        />
        <ModSlider
          label="LDL cholesterol"
          min={40}
          max={300}
          value={mods.LDL ?? Number(inputs.LDL)}
          onChange={(v) => setMods((m) => ({ ...m, LDL: v }))}
          unit="mg/dL"
        />
        <ModSlider
          label="HDL cholesterol"
          min={15}
          max={150}
          value={mods.HDL ?? Number(inputs.HDL)}
          onChange={(v) => setMods((m) => ({ ...m, HDL: v }))}
          unit="mg/dL"
        />
        <label className="flex items-center justify-between text-[11.5px] font-semibold text-slate-300">
          Quit smoking
          <input
            type="checkbox"
            checked={mods["Current Smoker"] === 0}
            onChange={(e) => setMods((m) => ({ ...m, "Current Smoker": e.target.checked ? 0 : 1 }))}
            className="h-4 w-4 accent-primary"
          />
        </label>

        <div className="flex items-center justify-between rounded-lg bg-surface p-2.5">
          <span className="text-[11px] font-semibold text-muted">
            Δ {selected.toUpperCase()}
            {busy ? " …" : ""}
          </span>
          <span
            className={`tabular text-[16px] font-extrabold ${
              !delta ? "text-muted" : delta.delta_pp < 0 ? "text-success" : "text-error"
            }`}
          >
            {delta ? `${delta.delta_pp > 0 ? "+" : ""}${delta.delta_pp} pp` : "—"}
          </span>
        </div>
        {result?.export_blocked ? (
          <p className="text-[10.5px] font-semibold text-warning">
            OOD combination — PDF export blocked, review required.
          </p>
        ) : (
          <p className="text-[10.5px] text-muted">
            Guardrail: values clamp to validated ranges. Threshold ≠ diagnosis.
          </p>
        )}
        <ExportButton disabled={!result || result.export_blocked} />
      </div>
    </div>
  );
}

function ModSlider({
  label,
  min,
  max,
  value,
  onChange,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-slate-300">{label}</span>
        <span className="tabular text-[11px] font-bold text-white">
          {value} <span className="text-[9px] font-medium text-muted">{unit}</span>
        </span>
      </div>
      <div className="relative h-3.5">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-surface-raised" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-3.5 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          aria-label={label}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-secondary bg-white"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ExportButton({ disabled }: { disabled: boolean }) {
  const inputs = useRiskStore((s) => s.inputs);
  const probs = useRiskStore((s) => s.probs);
  const shap = useRiskStore((s) => s.shap);

  const onExport = async () => {
    const { jsPDF } = await import("../lib/pdf");
    await jsPDF.generate({ inputs, probs, shap });
  };

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="w-full rounded-lg border border-line bg-surface py-2 text-[11.5px] font-bold text-slate-200 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      Export PDF report (watermarked)
    </button>
  );
}