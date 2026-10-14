"""Picklable calibrated head used by both training and serving.

Wraps the frozen preprocessing + XGBoost base + a sigmoid/isotonic calibrator
and exposes a single `predict_proba(raw_frame)` method.  Keeping this in its own
importable module makes `models.joblib` stable across train/serve processes.
"""
from __future__ import annotations

import numpy as np


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


class CalibratedHead:
    def __init__(self, pre, base, kind: str, calibrator, logit_scale: bool = False, fast=None):
        self.pre = pre
        self.base = base
        self.kind = kind  # "isotonic" | "sigmoid"
        self.calibrator = calibrator
        self.logit_scale = logit_scale
        self.fast = fast  # optional FastPre numpy fast path

    def _transform(self, X):
        fast = getattr(self, "fast", None)
        if fast is not None:
            return fast.transform(X)
        return self.pre.transform(X)

    def _raw(self, X) -> np.ndarray:
        return self.base.predict_proba(self._transform(X))[:, 1]

    def predict_proba(self, X) -> np.ndarray:
        raw = self._raw(X)
        if self.kind == "isotonic":
            p = self.calibrator.predict(raw)
        else:
            p = self.calibrator.predict_proba(_logit(raw).reshape(-1, 1))[:, 1]
        p = np.clip(np.asarray(p).reshape(-1), 0.0, 1.0)
        return np.column_stack([1 - p, p])

    def predict(self, X) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)