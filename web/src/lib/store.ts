// Zustand store. R3F subscribes ONLY to `probs` (perf: no re-render on form edits).
import { create } from "zustand";
import { api, ApiError } from "./api";
import { defaultValues } from "./features";
import type { ExplainResponse, HeadName, PredictResponse, Preset, Probs, Values } from "./types";

export type Screen = "dashboard" | "metrics" | "docs";

interface RiskState {
  inputs: Values;
  probs: Probs | null;
  shap: ExplainResponse | null;
  selected: HeadName;
  ood: boolean;
  preset: string | null;
  screen: Screen;
  running: boolean;
  error: string | null;
  latencyMs: number | null;
  safetyAck: boolean;
  showSafety: boolean;
  presets: Preset[];
  modelHash: string | null;

  setInput: (name: string, value: number | string) => void;
  applyPreset: (preset: Preset) => void;
  select: (head: HeadName) => void;
  setScreen: (s: Screen) => void;
  ackSafety: () => void;
  openSafety: () => void;
  loadPresets: () => Promise<void>;
  predict: (live?: boolean) => Promise<void>;
  explain: (target?: HeadName) => Promise<void>;
  setModelHash: (h: string | null) => void;
}

export const useRiskStore = create<RiskState>((set, get) => ({
  inputs: defaultValues(),
  probs: null,
  shap: null,
  selected: "cad",
  ood: false,
  preset: null,
  screen: "dashboard",
  running: false,
  error: null,
  latencyMs: null,
  safetyAck: false,
  showSafety: true,
  presets: [],
  modelHash: null,

  setInput: (name, value) => {
    set((s) => ({ inputs: { ...s.inputs, [name]: value }, preset: null }));
  },

  applyPreset: (preset) => {
    set({
      inputs: { ...defaultValues(), ...preset.inputs },
      preset: preset.id,
      probs: null,
      shap: null,
    });
  },

  select: (head) => set({ selected: head }),
  setScreen: (screen) => set({ screen }),
  ackSafety: () => set({ safetyAck: true, showSafety: false }),
  openSafety: () => set({ showSafety: true }),
  setModelHash: (modelHash) => set({ modelHash }),

  loadPresets: async () => {
    try {
      const { presets } = await api.presets();
      set({ presets });
    } catch {
      set({ presets: [] });
    }
  },

  predict: async (live = false) => {
    const { inputs } = get();
    if (!live) set({ running: true, error: null });
    try {
      const res: PredictResponse = await api.predict(inputs);
      set({ probs: res.probs, ood: res.ood, running: false, latencyMs: res.latency_ms, error: null });
      if (!live) await get().explain(get().selected);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Prediction failed";
      set({ running: false, error: msg });
    }
  },

  explain: async (target) => {
    const head = target ?? get().selected;
    const { inputs } = get();
    try {
      const res = await api.explain(inputs, head);
      set({ shap: res });
    } catch {
      set({ shap: null });
    }
  },
}));