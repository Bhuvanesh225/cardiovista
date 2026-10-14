// Mirror of app/features.py — the 55 allowed model inputs.
// The four angiography targets (Cath/LAD/LCX/RCA) are NEVER present here.

import type { Values } from "./types";

export type Kind = "num" | "bin" | "cat";

export interface FeatureSpec {
  name: string;
  label: string;
  group: string;
  kind: Kind;
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  default: number | string;
}

export const GROUPS = [
  "Demographics",
  "Vitals & Exam",
  "Symptoms",
  "ECG",
  "Laboratory",
  "Echocardiography",
] as const;

export const FEATURES: FeatureSpec[] = [
  { name: "Age", label: "Age", group: "Demographics", kind: "num", unit: "yrs", min: 18, max: 100, default: 56 },
  { name: "Sex", label: "Sex", group: "Demographics", kind: "cat", options: ["Male", "Fmale"], default: "Male" },
  { name: "Weight", label: "Weight", group: "Demographics", kind: "num", unit: "kg", min: 30, max: 200, default: 74 },
  { name: "Length", label: "Height", group: "Demographics", kind: "num", unit: "cm", min: 120, max: 220, default: 164 },
  { name: "BMI", label: "BMI", group: "Demographics", kind: "num", unit: "kg/m²", min: 12, max: 60, default: 26.5 },
  { name: "DM", label: "Diabetes (DM)", group: "Demographics", kind: "bin", default: 0 },
  { name: "HTN", label: "Hypertension (HTN)", group: "Demographics", kind: "bin", default: 0 },
  { name: "Current Smoker", label: "Current smoker", group: "Demographics", kind: "bin", default: 0 },
  { name: "EX-Smoker", label: "Ex-smoker", group: "Demographics", kind: "bin", default: 0 },
  { name: "FH", label: "Family history (FH)", group: "Demographics", kind: "bin", default: 0 },
  { name: "Obesity", label: "Obesity", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "CRF", label: "Renal failure (CRF)", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "CVA", label: "Stroke (CVA)", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Airway disease", label: "Airway disease", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Thyroid Disease", label: "Thyroid disease", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "CHF", label: "Heart failure (CHF)", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "DLP", label: "Dyslipidaemia (DLP)", group: "Demographics", kind: "cat", options: ["N", "Y"], default: "N" },

  { name: "BP", label: "Systolic BP", group: "Vitals & Exam", kind: "num", unit: "mmHg", min: 80, max: 250, default: 130 },
  { name: "PR", label: "Pulse rate", group: "Vitals & Exam", kind: "num", unit: "bpm", min: 30, max: 200, default: 78 },
  { name: "Edema", label: "Peripheral oedema", group: "Vitals & Exam", kind: "bin", default: 0 },
  { name: "Weak Peripheral Pulse", label: "Weak peripheral pulse", group: "Vitals & Exam", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Lung rales", label: "Lung rales", group: "Vitals & Exam", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Systolic Murmur", label: "Systolic murmur", group: "Vitals & Exam", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Diastolic Murmur", label: "Diastolic murmur", group: "Vitals & Exam", kind: "cat", options: ["N", "Y"], default: "N" },

  { name: "Typical Chest Pain", label: "Typical chest pain", group: "Symptoms", kind: "bin", default: 0 },
  { name: "Dyspnea", label: "Dyspnoea", group: "Symptoms", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Function Class", label: "NYHA function class", group: "Symptoms", kind: "cat", options: ["0", "1", "2", "3"], default: "0" },
  { name: "Atypical", label: "Atypical angina", group: "Symptoms", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Nonanginal", label: "Non-anginal pain", group: "Symptoms", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Exertional CP", label: "Exertional CP", group: "Symptoms", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "LowTH Ang", label: "Low-threshold angina", group: "Symptoms", kind: "cat", options: ["N", "Y"], default: "N" },

  { name: "Q Wave", label: "Q wave", group: "ECG", kind: "bin", default: 0 },
  { name: "St Elevation", label: "ST elevation", group: "ECG", kind: "bin", default: 0 },
  { name: "St Depression", label: "ST depression", group: "ECG", kind: "bin", default: 0 },
  { name: "Tinversion", label: "T inversion", group: "ECG", kind: "bin", default: 0 },
  { name: "LVH", label: "LV hypertrophy", group: "ECG", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "Poor R Progression", label: "Poor R progression", group: "ECG", kind: "cat", options: ["N", "Y"], default: "N" },
  { name: "BBB", label: "Bundle branch block", group: "ECG", kind: "cat", options: ["N", "LBBB", "RBBB"], default: "N" },

  { name: "FBS", label: "Fasting blood sugar", group: "Laboratory", kind: "num", unit: "mg/dL", min: 60, max: 500, default: 90 },
  { name: "CR", label: "Creatinine", group: "Laboratory", kind: "num", unit: "mg/dL", min: 0.3, max: 6, default: 1 },
  { name: "TG", label: "Triglycerides", group: "Laboratory", kind: "num", unit: "mg/dL", min: 30, max: 800, default: 150 },
  { name: "LDL", label: "LDL cholesterol", group: "Laboratory", kind: "num", unit: "mg/dL", min: 40, max: 400, default: 110 },
  { name: "HDL", label: "HDL cholesterol", group: "Laboratory", kind: "num", unit: "mg/dL", min: 15, max: 150, default: 38 },
  { name: "BUN", label: "Blood urea nitrogen", group: "Laboratory", kind: "num", unit: "mg/dL", min: 2, max: 90, default: 15 },
  { name: "ESR", label: "ESR", group: "Laboratory", kind: "num", unit: "mm/h", min: 1, max: 120, default: 18 },
  { name: "HB", label: "Haemoglobin", group: "Laboratory", kind: "num", unit: "g/dL", min: 6, max: 20, default: 13.8 },
  { name: "K", label: "Potassium", group: "Laboratory", kind: "num", unit: "mEq/L", min: 2.5, max: 7, default: 4.3 },
  { name: "Na", label: "Sodium", group: "Laboratory", kind: "num", unit: "mEq/L", min: 120, max: 160, default: 140 },
  { name: "WBC", label: "White cell count", group: "Laboratory", kind: "num", unit: "cells/µL", min: 1000, max: 20000, default: 7800 },
  { name: "Lymph", label: "Lymphocytes", group: "Laboratory", kind: "num", unit: "%", min: 1, max: 90, default: 34 },
  { name: "Neut", label: "Neutrophils", group: "Laboratory", kind: "num", unit: "%", min: 1, max: 95, default: 60 },
  { name: "PLT", label: "Platelets", group: "Laboratory", kind: "num", unit: "10³/µL", min: 20, max: 900, default: 230 },

  { name: "EF-TTE", label: "Ejection fraction", group: "Echocardiography", kind: "num", unit: "%", min: 10, max: 80, default: 50 },
  { name: "Region RWMA", label: "Region with RWMA", group: "Echocardiography", kind: "cat", options: ["0", "1", "2", "3", "4"], default: "0" },
  { name: "VHD", label: "Valvular heart disease", group: "Echocardiography", kind: "cat", options: ["N", "mild", "Moderate", "Severe"], default: "N" },
];

export const FEATURE_MAP: Record<string, FeatureSpec> = Object.fromEntries(
  FEATURES.map((f) => [f.name, f]),
);

export const defaultValues = (): Values =>
  Object.fromEntries(FEATURES.map((f) => [f.name, f.default]));

export const featureLabel = (name: string): string => FEATURE_MAP[name]?.label ?? name;
export const featureGroup = (name: string): string => FEATURE_MAP[name]?.group ?? "Other";