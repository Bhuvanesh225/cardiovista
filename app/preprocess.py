"""Frozen preprocessing + a vectorised fast path.

`make_preprocessor()` is the single source of truth used at training time.  At
serve time numpy is ~10x faster than re-running the sklearn ColumnTransformer,
so `FastPre` extracts the fitted parameters and reproduces the exact same
transform with plain numpy (no behaviour change — see tests/test_fastpre.py).
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def make_preprocessor(num_cols: list[str], cat_cols: list[str]):
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    num_pipe = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])
    cat_pipe = Pipeline(
        [("imp", SimpleImputer(strategy="most_frequent")), ("oh", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]
    )
    return ColumnTransformer(
        [
            ("num", num_pipe, list(num_cols)),
            ("cat", cat_pipe, list(cat_cols)),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


class FastPre:
    """Reproduces a fitted ColumnTransformer(num, cat) with numpy."""

    def __init__(self, ct, num_cols: list[str], cat_cols: list[str]):
        self.num_cols = list(num_cols)
        self.cat_cols = list(cat_cols)
        num_pipe = ct.named_transformers_["num"]
        cat_pipe = ct.named_transformers_["cat"]
        imp = num_pipe.named_steps["imp"]
        sc = num_pipe.named_steps["sc"]
        self.num_fill = np.asarray(imp.statistics_, dtype=float)
        self.num_mean = np.asarray(sc.mean_, dtype=float)
        self.num_scale = np.asarray(sc.scale_, dtype=float)
        self.num_scale[self.num_scale == 0] = 1.0
        oh = cat_pipe.named_steps["oh"]
        self.cat_categories = [np.asarray(c) for c in oh.categories_]
        self.cat_fill = np.asarray(cat_pipe.named_steps["imp"].statistics_)
        self.output_names = list(ct.get_feature_names_out())

    def transform(self, frame: pd.DataFrame) -> np.ndarray:
        n = len(frame)
        out_parts = []
        # numeric block
        num = frame[self.num_cols].to_numpy(dtype=float, na_value=np.nan)
        if num.size:
            nan_mask = np.isnan(num)
            if nan_mask.any():
                num[nan_mask] = np.take(self.num_fill, np.where(nan_mask)[1])
            num = (num - self.num_mean) / self.num_scale
            out_parts.append(num)
        # categorical block (one-hot, handle_unknown -> all zeros)
        cat = frame[self.cat_cols].to_numpy(dtype=object)
        cat_out = np.zeros((n, sum(len(c) for c in self.cat_categories)), dtype=float)
        offset = 0
        for j, cats in enumerate(self.cat_categories):
            col = cat[:, j]
            for i in range(n):
                v = col[i]
                if v is None or (isinstance(v, float) and np.isnan(v)):
                    v = self.cat_fill[j]
                idx = np.where(cats == v)[0]
                if idx.size:
                    cat_out[i, offset + int(idx[0])] = 1.0
            offset += len(cats)
        out_parts.append(cat_out)
        return np.hstack(out_parts) if out_parts else np.zeros((n, 0))