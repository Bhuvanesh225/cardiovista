"""Canonical feature specification for CardioVista.

Single source of truth for the 55 allowed model inputs from the UCI
"Extension of Z-Alizadeh Sani" dataset (n=303).  The four angiography
targets (Cath/LAD/LCX/RCA) are NEVER inputs and are not listed here.

The frontend mirrors this in web/src/lib/features.ts.
"""
from __future__ import annotations

from typing import Any

# name -> (label, group, kind, unit, min, max, options, default)
# kind: "num" | "bin" | "cat"
# For "bin" options are [0, 1] (0=No, 1=Yes). For "cat" options are display strings.
NUM = "num"
BIN = "bin"
CAT = "cat"

FEATURES: list[dict[str, Any]] = [
    # --- demographics ---------------------------------------------------
    {"name": "Age", "label": "Age", "group": "Demographics", "kind": NUM, "unit": "yrs", "min": 18, "max": 100, "default": 56},
    {"name": "Sex", "label": "Sex", "group": "Demographics", "kind": CAT, "options": ["Male", "Fmale"], "default": "Male"},
    {"name": "Weight", "label": "Weight", "group": "Demographics", "kind": NUM, "unit": "kg", "min": 30, "max": 200, "default": 74},
    {"name": "Length", "label": "Height", "group": "Demographics", "kind": NUM, "unit": "cm", "min": 120, "max": 220, "default": 164},
    {"name": "BMI", "label": "BMI", "group": "Demographics", "kind": NUM, "unit": "kg/m²", "min": 12, "max": 60, "default": 26.5},
    {"name": "DM", "label": "Diabetes (DM)", "group": "Demographics", "kind": BIN, "default": 0},
    {"name": "HTN", "label": "Hypertension (HTN)", "group": "Demographics", "kind": BIN, "default": 0},
    {"name": "Current Smoker", "label": "Current smoker", "group": "Demographics", "kind": BIN, "default": 0},
    {"name": "EX-Smoker", "label": "Ex-smoker", "group": "Demographics", "kind": BIN, "default": 0},
    {"name": "FH", "label": "Family history (FH)", "group": "Demographics", "kind": BIN, "default": 0},
    {"name": "Obesity", "label": "Obesity", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "CRF", "label": "Renal failure (CRF)", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "CVA", "label": "Stroke (CVA)", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Airway disease", "label": "Airway disease", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Thyroid Disease", "label": "Thyroid disease", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "CHF", "label": "Heart failure (CHF)", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "DLP", "label": "Dyslipidaemia (DLP)", "group": "Demographics", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    # --- vitals & exam --------------------------------------------------
    {"name": "BP", "label": "Systolic BP", "group": "Vitals & Exam", "kind": NUM, "unit": "mmHg", "min": 80, "max": 250, "default": 130},
    {"name": "PR", "label": "Pulse rate", "group": "Vitals & Exam", "kind": NUM, "unit": "bpm", "min": 30, "max": 200, "default": 78},
    {"name": "Edema", "label": "Peripheral oedema", "group": "Vitals & Exam", "kind": BIN, "default": 0},
    {"name": "Weak Peripheral Pulse", "label": "Weak peripheral pulse", "group": "Vitals & Exam", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Lung rales", "label": "Lung rales", "group": "Vitals & Exam", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Systolic Murmur", "label": "Systolic murmur", "group": "Vitals & Exam", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Diastolic Murmur", "label": "Diastolic murmur", "group": "Vitals & Exam", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    # --- symptoms -------------------------------------------------------
    {"name": "Typical Chest Pain", "label": "Typical chest pain", "group": "Symptoms", "kind": BIN, "default": 0},
    {"name": "Dyspnea", "label": "Dyspnoea", "group": "Symptoms", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Function Class", "label": "NYHA function class", "group": "Symptoms", "kind": CAT, "options": ["0", "1", "2", "3"], "default": "0"},
    {"name": "Atypical", "label": "Atypical angina", "group": "Symptoms", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Nonanginal", "label": "Non-anginal pain", "group": "Symptoms", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Exertional CP", "label": "Exertional CP", "group": "Symptoms", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "LowTH Ang", "label": "Low-threshold angina", "group": "Symptoms", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    # --- ECG ------------------------------------------------------------
    {"name": "Q Wave", "label": "Q wave", "group": "ECG", "kind": BIN, "default": 0},
    {"name": "St Elevation", "label": "ST elevation", "group": "ECG", "kind": BIN, "default": 0},
    {"name": "St Depression", "label": "ST depression", "group": "ECG", "kind": BIN, "default": 0},
    {"name": "Tinversion", "label": "T inversion", "group": "ECG", "kind": BIN, "default": 0},
    {"name": "LVH", "label": "LV hypertrophy", "group": "ECG", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "Poor R Progression", "label": "Poor R progression", "group": "ECG", "kind": CAT, "options": ["N", "Y"], "default": "N"},
    {"name": "BBB", "label": "Bundle branch block", "group": "ECG", "kind": CAT, "options": ["N", "LBBB", "RBBB"], "default": "N"},
    # --- labs -----------------------------------------------------------
    {"name": "FBS", "label": "Fasting blood sugar", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 60, "max": 500, "default": 90},
    {"name": "CR", "label": "Creatinine", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 0.3, "max": 6.0, "default": 1.0},
    {"name": "TG", "label": "Triglycerides", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 30, "max": 800, "default": 150},
    {"name": "LDL", "label": "LDL cholesterol", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 40, "max": 400, "default": 110},
    {"name": "HDL", "label": "HDL cholesterol", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 15, "max": 150, "default": 38},
    {"name": "BUN", "label": "Blood urea nitrogen", "group": "Laboratory", "kind": NUM, "unit": "mg/dL", "min": 2, "max": 90, "default": 15},
    {"name": "ESR", "label": "ESR", "group": "Laboratory", "kind": NUM, "unit": "mm/h", "min": 1, "max": 120, "default": 18},
    {"name": "HB", "label": "Haemoglobin", "group": "Laboratory", "kind": NUM, "unit": "g/dL", "min": 6, "max": 20, "default": 13.8},
    {"name": "K", "label": "Potassium", "group": "Laboratory", "kind": NUM, "unit": "mEq/L", "min": 2.5, "max": 7.0, "default": 4.3},
    {"name": "Na", "label": "Sodium", "group": "Laboratory", "kind": NUM, "unit": "mEq/L", "min": 120, "max": 160, "default": 140},
    {"name": "WBC", "label": "White cell count", "group": "Laboratory", "kind": NUM, "unit": "cells/µL", "min": 1000, "max": 20000, "default": 7800},
    {"name": "Lymph", "label": "Lymphocytes", "group": "Laboratory", "kind": NUM, "unit": "%", "min": 1, "max": 90, "default": 34},
    {"name": "Neut", "label": "Neutrophils", "group": "Laboratory", "kind": NUM, "unit": "%", "min": 1, "max": 95, "default": 60},
    {"name": "PLT", "label": "Platelets", "group": "Laboratory", "kind": NUM, "unit": "10³/µL", "min": 20, "max": 900, "default": 230},
    # --- echo -----------------------------------------------------------
    {"name": "EF-TTE", "label": "Ejection fraction", "group": "Echocardiography", "kind": NUM, "unit": "%", "min": 10, "max": 80, "default": 50},
    {"name": "Region RWMA", "label": "Region with RWMA", "group": "Echocardiography", "kind": CAT, "options": ["0", "1", "2", "3", "4"], "default": "0"},
    {"name": "VHD", "label": "Valvular heart disease", "group": "Echocardiography", "kind": CAT, "options": ["N", "mild", "Moderate", "Severe"], "default": "N"},
]

FEATURE_NAMES: list[str] = [f["name"] for f in FEATURES]
FEATURE_MAP: dict[str, dict[str, Any]] = {f["name"]: f for f in FEATURES}

TARGETS = ["cad", "lad", "lcx", "rca"]

# Per-target forbidden columns (hard leakage firewall).
FORBIDDEN: dict[str, list[str]] = {
    "cad": ["LAD", "LCX", "RCA", "Cath"],
    "lad": ["Cath", "LCX", "RCA"],
    "lcx": ["Cath", "LAD", "RCA"],
    "rca": ["Cath", "LAD", "LCX"],
}

# Flat set of every name that must never arrive as an input.
FORBIDDEN_ANY = {"Cath", "LAD", "LCX", "RCA", "cad", "CAD"}

# Physiological range chips (validation).  Age handled separately (>=18).
RANGES: dict[str, tuple[float, float]] = {
    f["name"]: (f["min"], f["max"]) for f in FEATURES if f["kind"] == NUM
}

GROUPS = ["Demographics", "Vitals & Exam", "Symptoms", "ECG", "Laboratory", "Echocardiography"]


def default_inputs() -> dict[str, Any]:
    """Population defaults (train.py overwrites these with dataset medians/modes)."""
    return {f["name"]: f["default"] for f in FEATURES}