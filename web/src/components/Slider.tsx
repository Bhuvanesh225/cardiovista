import type { FeatureSpec } from "../lib/features";

interface SliderProps {
  spec: FeatureSpec;
  value: number;
  onChange: (v: number) => void;
}

export function Slider({ spec, value, onChange }: SliderProps) {
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  const pct = ((value - min) / (max - min)) * 100;
  const step = spec.name === "CR" ? 0.1 : spec.name === "K" || spec.name === "HB" ? 0.1 : 1;
  const id = `slider-${spec.name.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] font-semibold text-slate-300">
          {spec.label}
        </label>
        <span className="tabular text-[12px] font-bold text-white">
          {value}
          {spec.unit ? <span className="ml-0.5 text-[10px] font-medium text-muted">{spec.unit}</span> : null}
        </span>
      </div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-surface-raised" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow"
          style={{ left: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${spec.label} in ${spec.unit ?? ""}`}
          className="absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
    </div>
  );
}