import { useEffect } from "react";
import { useRiskStore } from "../lib/store";
import { PatientPanel } from "./PatientPanel";
import { ViewerPanel } from "./ViewerPanel";
import { RiskPanel } from "./RiskPanel";

export function Dashboard() {
  const predict = useRiskStore((s) => s.predict);
  const safetyAck = useRiskStore((s) => s.safetyAck);
  const presets = useRiskStore((s) => s.presets);
  const applyPreset = useRiskStore((s) => s.applyPreset);
  const error = useRiskStore((s) => s.error);

  // auto-run the first frozen preset once the safety modal is acknowledged
  useEffect(() => {
    if (safetyAck && presets.length && !useRiskStore.getState().probs) {
      applyPreset(presets[0]);
      void predict(false);
    }
  }, [safetyAck, presets, applyPreset, predict]);

  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[340px_minmax(0,1fr)_416px]">
      <div className="min-h-0 lg:h-full">
        <PatientPanel />
      </div>
      <div className="min-h-0 lg:h-full">
        <ViewerPanel />
      </div>
      <div className="min-h-0 lg:h-full">
        <RiskPanel />
      </div>
      {error ? (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-error/50 bg-error/15 px-4 py-2 text-[12px] font-semibold text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}