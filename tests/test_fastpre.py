"""The numpy FastPre fast path must reproduce the sklearn ColumnTransformer."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_MAP  # noqa: E402
from app.preprocess import FastPre, make_preprocessor  # noqa: E402

NUMERIC = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "num"]
BINARY = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "bin"]
CATEGORICAL = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "cat"]
NUM = NUMERIC + BINARY


@pytest.fixture(scope="module")
def fitted():
    rng = np.random.default_rng(0)
    n = 200
    data = {}
    for k in NUM:
        data[k] = rng.normal(50, 10, n)
    for k in CATEGORICAL:
        opts = FEATURE_MAP[k]["options"]
        data[k] = rng.choice(opts, n)
    df = pd.DataFrame(data)
    ct = make_preprocessor(NUM, CATEGORICAL)
    Xt = ct.fit_transform(df)
    fast = FastPre(ct, NUM, CATEGORICAL)
    return ct, fast, df


def test_fastpre_matches_sklearn(fitted):
    ct, fast, df = fitted
    ref = ct.transform(df)
    got = fast.transform(df)
    assert got.shape == ref.shape
    assert np.allclose(ref, got, atol=1e-9)


def test_fastpre_handles_unknown_category(fitted):
    ct, fast, df = fitted
    df2 = df.copy()
    df2.loc[0, CATEGORICAL[0]] = "__unseen__"
    ref = ct.transform(df2)
    got = fast.transform(df2)
    assert np.allclose(ref, got, atol=1e-9)