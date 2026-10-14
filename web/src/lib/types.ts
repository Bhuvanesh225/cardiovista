// Shared types for the CardioVista frontend.

export type Values = Record<string, number | string>;

export type HeadName = "cad" | "lad" | "lcx" | "rca";
export const HEADS: HeadName[] = ["cad", "lad", "lcx", "rca"];

export interface HeadProb {
  p: number;
  ci: [number, number];
  ci_halfwidth?: number;
  threshold: number;
  flag: "low" | "moderate" | "high";
  uncertain?: boolean;
  calibration: string;
  brier: number;
  ece?: number;
  roc_auc?: number | null;
}

export type Probs = Record<HeadName, HeadProb>;

export interface PredictResponse {
  probs: Probs;
  ood: boolean;
  inputs_used: Values;
  latency_ms: number;
}

export interface ShapValue {
  feature: string;
  shap: number;
  value: number | string;
  direction: "up" | "down";
}

export interface ExplainResponse {
  target: HeadName;
  values: ShapValue[];
  all_values: { feature: string; shap: number }[];
  base_value: number;
  groups: { group: string; shap: number }[];
  latency_ms: number;
}

export interface CounterfactualResponse {
  target: HeadName;
  deltas: Record<HeadName, { before: number; after: number; delta_pp: number }>;
  combined_delta_pp: number;
  ood: boolean;
  export_blocked: boolean;
  latency_ms: number;
}

export interface HeadMetrics {
  head: HeadName;
  roc_auc: number;
  roc_ci: [number, number];
  pr_auc: number;
  brier: number;
  brier_sigmoid?: number;
  brier_isotonic?: number;
  ece: number;
  youden: number;
  sensitivity_at_youden: number;
  cv_auc_mean: number;
  cv_auc_sd: number;
  cv_fits: number;
  calibration: string;
  n_pos: number;
  n_test?: number;
  n_pos_test?: number;
  confusion_youden: number[][];
  "confusion_0.5": number[][];
}

export interface MetricsResponse {
  generated_at: string;
  seed: number;
  n_rows: number;
  n_features: number;
  model_hash: string | null;
  mesh_sha: string | null;
  repeats: number;
  heads: Record<HeadName, HeadMetrics>;
}

export interface ModelInfo {
  model_hash: string | null;
  mesh_sha: string | null;
  mesh_name: string;
  trained_at: string;
  seed: number;
  thresholds: Record<HeadName, number>;
  brier: Record<HeadName, number>;
  calibration: Record<HeadName, string>;
  n_train_rows: number;
}

export interface Preset {
  id: string;
  label: string;
  note: string;
  inputs: Values;
  expected?: Record<HeadName, number>;
  flag?: string;
}

// Risk banding (canonical, colorblind-safe, shared with the legend).
export const riskBand = (p: number): "success" | "warning" | "error" =>
  p > 0.6 ? "error" : p >= 0.3 ? "warning" : "success";

export const bandColor = (p: number): string =>
  p > 0.6 ? "#FB2C36" : p >= 0.3 ? "#FF6900" : "#00C950";

export const VESSEL_META: Record<Exclude<HeadName, "cad">, { name: string; full: string }> = {
  lad: { name: "LAD", full: "Left anterior descending" },
  lcx: { name: "LCX", full: "Left circumflex" },
  rca: { name: "RCA", full: "Right coronary artery" },
};