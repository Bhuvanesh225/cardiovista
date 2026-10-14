"""Out-of-distribution detection.

IsolationForest(contamination=0.05) fitted on the training inputs.  An unseen
patient lying outside the fitted support raises an amber `OOD-review` badge:
we still show the prediction (honesty over hiding) but block PDF export.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "models"
OOD_PATH = MODEL_DIR / "ood.joblib"


class OODDetector:
    def __init__(self, path: Path = OOD_PATH):
        self._pipe = None
        self._keys: list[str] | None = None
        if path.exists():
            bundle = joblib.load(path)
            self._pipe = bundle["pipe"]
            self._keys = bundle["keys"]

    @property
    def available(self) -> bool:
        return self._pipe is not None

    def score(self, row: dict[str, Any]) -> bool:
        """True when the row is flagged out-of-distribution."""
        if self._pipe is None or not self._keys:
            return False
        vec = [float(row.get(k, 0.0) or 0.0) for k in self._keys]
        x = np.asarray([vec], dtype=float)
        pred = self._pipe.predict(x)[0]
        return int(pred) == -1