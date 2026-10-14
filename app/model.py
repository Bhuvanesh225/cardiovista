"""RiskModel adapter.

Loads the trained bundle produced by `train/train.py` and exposes the frozen
contract used by the API:

    predict_proba(dict) -> {cad, lad, lcx, rca, ci}    (4 heads + CI + flag)
    explain(dict)       -> {values, base_value, groups}

Each head is a calibrated scikit-learn pipeline (base = XGBoost wrapped in the
frozen ColumnTransformer, calibrator = sigmoid or isotonic chosen by the
Brier-gated rule).  A second, uncalibrated fit of the base is retained purely
for TreeSHAP.  Everything is committed in `app/models/models.joblib`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .features import FEATURE_NAMES, default_inputs

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = APP_DIR / "models" / "models.joblib"
REGISTRY_PATH = APP_DIR / "registry.json"


class RiskModel:
    def __init__(self, path: Path = MODEL_PATH):
        self.path = path
        self.bundle: dict[str, Any] = joblib.load(path)
        self.defaults: dict[str, Any] = self.bundle.get("defaults", default_inputs())
        self.feature_names: list[str] = self.bundle["feature_names"]
        self.heads: dict[str, Any] = self.bundle["heads"]
        self._explainers: dict[str, Any] = {}
        self.registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    # -- ordered raw frame ------------------------------------------------
    def _frame(self, values: dict[str, Any]) -> pd.DataFrame:
        row = {}
        for name in self.feature_names:
            v = values.get(name, self.defaults.get(name, 0))
            row[name] = self.defaults.get(name, 0) if v is None else v
        return pd.DataFrame([row], columns=self.feature_names)

    @staticmethod
    def _flag(p: float) -> str:
        if p >= 0.60:
            return "high"
        if p >= 0.30:
            return "moderate"
        return "low"

    # -- prediction -------------------------------------------------------
    def predict_proba(self, values: dict[str, Any]) -> dict[str, Any]:
        X = self._frame(values)
        out: dict[str, Any] = {}
        for head_name, head in self.heads.items():
            p = float(head["clf"].predict_proba(X)[0, 1])
            ci_pm = float(head.get("ci_pm", 0.05))
            out[head_name] = {
                "p": round(p, 4),
                "ci": [round(max(0.0, p - ci_pm), 4), round(min(1.0, p + ci_pm), 4)],
                "threshold": round(float(head["threshold"]), 3),
                "flag": self._flag(p),
                "calibration": head["calibration"],
                "brier": round(float(head["brier"]), 4),
            }
        return out

    # -- explainability ---------------------------------------------------
    def _explainer(self, head_name: str):
        if head_name not in self._explainers:
            import shap

            head = self.heads[head_name]
            base_pipe = head["base_pipe"]
            self._explainers[head_name] = shap.TreeExplainer(
                base_pipe.named_steps["clf"],
                data=head["shap_background"],
                feature_perturbation="interventional",
            )
        return self._explainers[head_name]

    def explain(self, values: dict[str, Any], head_name: str = "cad", top_k: int = 8) -> dict[str, Any]:
        head = self.heads[head_name]
        base_pipe = head["base_pipe"]
        X = self._frame(values)
        pre = head["clf"].pre if head.get("clf") is not None else base_pipe.named_steps["pre"]
        fast = getattr(head.get("clf"), "fast", None)
        Xt = fast.transform(X) if fast is not None else pre.transform(X)
        explainer = self._explainer(head_name)
        sv = explainer.shap_values(Xt, check_additivity=False)
        if isinstance(sv, list):
            sv = sv[0]
        sv = np.asarray(sv).reshape(-1)

        src_names = head["shap_sources"]
        grouped: dict[str, float] = {}
        for name, contrib in zip(src_names, sv):
            grouped[name] = grouped.get(name, 0.0) + float(contrib)

        base_value = float(np.ravel(explainer.expected_value)[0])
        ranked = sorted(grouped.items(), key=lambda kv: abs(kv[1]), reverse=True)

        values_out = []
        for feat, contrib in ranked[:top_k]:
            values_out.append(
                {
                    "feature": feat,
                    "value": values.get(feat, self.defaults.get(feat)),
                    "shap": round(contrib, 4),
                    "direction": "up" if contrib >= 0 else "down",
                }
            )

        from .features import FEATURE_MAP

        group_totals: dict[str, float] = {}
        for feat, contrib in grouped.items():
            grp = FEATURE_MAP.get(feat, {}).get("group", "Other")
            group_totals[grp] = group_totals.get(grp, 0.0) + contrib
        groups = [
            {"group": g, "shap": round(v, 4)}
            for g, v in sorted(group_totals.items(), key=lambda kv: abs(kv[1]), reverse=True)
        ]
        return {
            "target": head_name,
            "values": values_out,
            "all_values": [{"feature": f, "shap": round(c, 4)} for f, c in ranked],
            "base_value": round(base_value, 4),
            "groups": groups,
        }


_singleton: RiskModel | None = None


def get_model() -> RiskModel:
    global _singleton
    if _singleton is None:
        _singleton = RiskModel()
    return _singleton