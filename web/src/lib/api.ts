// Typed API client for the versioned CardioVista backend.
import type {
  CounterfactualResponse,
  ExplainResponse,
  HeadName,
  MetricsResponse,
  ModelInfo,
  PredictResponse,
  Preset,
  Values,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    const d = (detail as { detail?: { message?: string } }).detail;
    const message = typeof d === "string" ? d : d?.message ?? res.statusText;
    throw new ApiError(res.status, message, detail);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new ApiError(res.status, res.statusText, null);
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export const api = {
  health: () => get<{ status: string; model_hash: string; mesh_sha: string }>("/v1/health"),
  modelInfo: () => get<ModelInfo>("/v1/model-info"),
  metrics: () => get<MetricsResponse>("/v1/metrics"),
  presets: () => get<{ presets: Preset[] }>("/v1/presets"),
  predict: (inputs: Values) => post<PredictResponse>("/v1/predict", inputs),
  explain: (inputs: Values, target: HeadName) => post<ExplainResponse>("/v1/explain", { inputs, target }),
  counterfactual: (inputs: Values, mods: Values, target: HeadName) =>
    post<CounterfactualResponse>("/v1/counterfactual", { inputs, mods, target }),
};