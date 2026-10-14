import { useState } from "react";
import { FEATURES, GROUPS } from "../lib/features";
import { useRiskStore } from "../lib/store";
import { Slider } from "./Slider";

const HEADLINE = new Set(["Age", "BP", "PR", "LDL", "HDL", "EF-TTE", "FBS", "TG"]);
const EXTRA = new Set(["Sex", "Weight", "Length", "BMI", "DM", "HTN", "Current Smoker", "FH", "Typical Chest Pain", "St Depression", "Tinversion", "Q Wave", "Region RWMA", "Function Class", "VHD", "Obesity", "DLP"]);

export function PatientPanel() {
  const inputs = useRiskStore((s) => s.inputs);
  const setInput = useRiskStore((s) => s.setInput);
  const predict = useRiskStore((s) => s.predict);
  const running = useRiskStore((s) => s.running);
  const presets = useRiskStore((s) => s.presets);
  const applyPreset = useRiskStore((s) => s.applyPreset);
  const activePreset = useRiskStore((s) => s.preset);
  const [details, setDetails] = useState(false);

  const visible = FEATURES.filter((f) => HEADLINE.has(f.name) || (details && EXTRA.has(f.name)));

  const onCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return;
    const header = lines[0].split(",").map((h) => h.trim());
    // first row only for the demo (rows processed in-memory, no PHI stored)
    const row = lines[1].split(",").map((c) => c.trim());
    header.forEach((h, i) => {
      const spec = FEATURES.find((f) => f.name === h);
      if (!spec) return;
      const raw = row[i];
      if (spec.kind === "num") setInput(h, Number(raw));
      else setInput(h, raw);
    });
  };

  return (
    <section aria-label="Patient data" className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface shadow-panel lg:h-full">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-200">Patient data</h2>
        <button
          type="button"
          onClick={() => setDetails((d) => !d)}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          {details ? "Fewer fields" : "More fields"}
        </button>
      </header>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            aria-pressed={activePreset === p.id}
            data-testid={`preset-${p.id}`}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              activePreset === p.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-line bg-surface-container text-muted hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {GROUPS.map((group) => {
          const specs = visible.filter((f) => f.group === group);
          if (!specs.length) return null;
          return (
            <div key={group} className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{group}</h3>
              {specs.map((spec) => {
                const value = inputs[spec.name];
                if (spec.kind === "num") {
                  return (
                    <Slider
                      key={spec.name}
                      spec={spec}
                      value={Number(value)}
                      onChange={(v) => setInput(spec.name, v)}
                    />
                  );
                }
                if (spec.kind === "bin") {
                  return (
                    <Segmented
                      key={spec.name}
                      label={spec.label}
                      options={["No", "Yes"]}
                      value={Number(value) === 1 ? "Yes" : "No"}
                      onChange={(v) => setInput(spec.name, v === "Yes" ? 1 : 0)}
                    />
                  );
                }
                return (
                  <Segmented
                    key={spec.name}
                    label={spec.label}
                    options={spec.options ?? []}
                    value={String(value)}
                    onChange={(v) => setInput(spec.name, v)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-line p-4">
        <button
          type="button"
          data-testid="run-prediction"
          onClick={() => predict(false)}
          disabled={running}
          className="w-full rounded-xl bg-primary py-3 text-[14px] font-extrabold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {running ? "Running…" : "Run prediction"}
        </button>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-container py-2 text-[11.5px] font-semibold text-muted transition hover:text-white">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])}
          />
          Upload CSV (one row, no PHI)
        </label>
      </div>
    </section>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[12px] font-semibold text-slate-300">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`min-w-[36px] flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
              value === o
                ? "border-primary bg-primary/15 text-primary"
                : "border-line bg-surface-container text-muted hover:text-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}