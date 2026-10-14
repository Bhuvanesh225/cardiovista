"""Pick frozen exemplars from the real (de-identified) dataset rows.

Scans the 303 training rows with the served model and selects the rows whose
predicted CAD probability lands closest to three target bands:
  * high       (~0.80)  typical angina, older, abnormal ECG/echo
  * low        (~0.15)  young, normal ECG, protective HDL
  * borderline (~0.50)  genuinely uncertain

The chosen rows become `app/presets.json` (real feature values, no identifiers),
shared by the dashboard, the docs and the e2e tests.

    python train/pick_presets.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_MAP, FEATURE_NAMES  # noqa: E402
from app.model import RiskModel  # noqa: E402

RAW_XLSX = ROOT / "data" / "raw" / "extention of Z-Alizadeh sani dataset.xlsx"


def load_frame():
    import pandas as pd

    return pd.read_excel(RAW_XLSX)

BANDS = [
    ("typical-angina-58m", "Typical angina · high risk", 0.87, "high"),
    ("low-risk-44f", "Low risk · young, normal ECG", 0.14, "low"),
    ("borderline-61m", "Borderline · uncertain", 0.56, "moderate"),
]


def row_to_inputs(df, idx: int) -> dict:
    out: dict = {}
    for f in FEATURE_MAP.values():
        v = df.iloc[idx][f["name"]]
        if f["kind"] == "num":
            out[f["name"]] = float(np.round(float(v), 2))
        elif f["kind"] == "bin":
            out[f["name"]] = int(v)
        else:
            out[f["name"]] = str(v)
    return out


def main() -> None:
    bundle = ROOT / "app" / "models" / "models.joblib"
    model = RiskModel(bundle)
    df = load_frame()
    df.columns = [str(c).strip() for c in df.columns]

    # predict on the SAME rounded inputs that get stored (so presets replay exactly)
    rounded = [row_to_inputs(df, i) for i in range(len(df))]
    probs = np.asarray([model.predict_proba({**model.defaults, **r})["cad"]["p"] for r in rounded])

    presets = []
    used: set[int] = set()
    for pid, label, target, flag in BANDS:
        order = np.argsort(np.abs(probs - target))
        idx = next(int(i) for i in order if int(i) not in used)
        used.add(idx)
        inputs = rounded[idx]
        outputs = model.predict_proba({**model.defaults, **inputs})
        presets.append(
            {
                "id": pid,
                "label": label,
                "note": "Real de-identified UCI row (seed 42 model). Shared by docs, video and e2e.",
                "source_row": idx,
                "inputs": inputs,
                "expected": {h: outputs[h]["p"] for h in ("cad", "lad", "lcx", "rca")},
                "flag": flag,
            }
        )
        print(f"[preset:{pid}] row={idx} CAD={outputs['cad']['p']:.3f} (target {target})")

    (ROOT / "app" / "presets.json").write_text(
        json.dumps({"presets": presets}, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("[done] presets.json written from real dataset rows")


if __name__ == "__main__":
    main()