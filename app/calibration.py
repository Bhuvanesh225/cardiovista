"""Picklable calibrated heads used by both training and serving.

`CalibratedHead` wraps the frozen preprocessing + XGBoost base + a
sigmoid/isotonic calibrator. `EnsembleHead` averages the raw probabilities of
a tuned XGBoost pipe and an L2-logistic pipeline, then applies a single
Brier-gated calibrator fitted on the averaged OOF raw scores. Both expose
`predict_proba(raw_frame)`. Keeping these in their own importable module makes
`models.joblib` stable across train/serve processes.
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


class EnsembleHead:
    """Averaged-raw ensemble of an XGBoost pipe and a logistic pipeline.

    Raw P = (raw_xgb + raw_lr) / 2, then one shared sigmoid/isotonic
    calibrator (chosen by the Brier-gated rule on OOF ensemble raw).
    `base_pipe` for SHAP stays the XGBoost pipe (TreeExplainer-compatible).
    """

    def __init__(self, pre_xgb, base_xgb, pipe_lr, kind: str, calibrator, fast=None):
        self.pre = pre_xgb
        self.base = base_xgb
        self.pipe_lr = pipe_lr
        self.kind = kind  # "isotonic" | "sigmoid"
        self.calibrator = calibrator
        self.fast = fast  # optional FastPre numpy fast path for the XGB leg

    def _transform(self, X):
        fast = getattr(self, "fast", None)
        if fast is not None:
            return fast.transform(X)
        return self.pre.transform(X)

    def _raw(self, X) -> np.ndarray:
        import pandas as pd

        raw_xgb = self.base.predict_proba(self._transform(X))[:, 1]
        raw_lr = self.pipe_lr.predict_proba(X)[:, 1]
        return (np.asarray(raw_xgb).reshape(-1) + np.asarray(raw_lr).reshape(-1)) / 2.0

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