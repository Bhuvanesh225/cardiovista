"""Latency benchmark harness (CPU only, no GPU).

    python train/bench_latency.py --n 500

Writes artifacts/bench_latency.json with p50/p95 for /predict, /explain and the
counterfactual round-trip, plus the frozen budgets from the plan.
"""
from __future__ import annotations

import argparse
import json
import statistics as stats
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_NAMES, default_inputs  # noqa: E402

ARTIFACTS = ROOT / "artifacts"


def sample_rows(n: int) -> list[dict]:
    import numpy as np

    rng = np.random.default_rng(42)
    rows = []
    for _ in range(n):
        row = default_inputs()
        for k in ("Age", "BP", "PR", "FBS", "TG", "LDL", "HDL", "EF-TTE", "WBC", "PLT"):
            row[k] = int(rng.integers(20, 400)) if k != "Age" else int(rng.integers(18, 90))
        rows.append(row)
    return rows


def pct(vals: list[float], q: float) -> float:
    vals = sorted(vals)
    idx = min(len(vals) - 1, int(q * len(vals)))
    return round(vals[idx], 2)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=500)
    args = ap.parse_args()

    from app.model import get_model

    model = get_model()
    rows = sample_rows(args.n)

    # predict
    predict_ms = []
    for r in rows:
        t0 = time.perf_counter()
        model.predict_proba(r)
        predict_ms.append((time.perf_counter() - t0) * 1000)

    # explain (subset — TreeSHAP is heavier)
    explain_ms = []
    for r in rows[: min(60, len(rows))]:
        t0 = time.perf_counter()
        model.explain(r, "cad", top_k=8)
        explain_ms.append((time.perf_counter() - t0) * 1000)

    # counterfactual round trip
    cf_ms = []
    for r in rows[: min(200, len(rows))]:
        t0 = time.perf_counter()
        model.predict_proba(r)
        model.predict_proba({**r, "BP": 120, "Current Smoker": 0})
        cf_ms.append((time.perf_counter() - t0) * 1000)

    out = {
        "n": args.n,
        "note": "CPU-only, single process; measures the RiskModel adapter (in-process, no HTTP).",
        "predict_ms": {"p50": pct(predict_ms, 0.5), "p95": pct(predict_ms, 0.95)},
        "explain_ms": {"p50": pct(explain_ms, 0.5), "p95": pct(explain_ms, 0.95), "n": len(explain_ms)},
        "counterfactual_ms": {"p50": pct(cf_ms, 0.5), "p95": pct(cf_ms, 0.95), "n": len(cf_ms)},
        "budget": {"predict_p95_ms": 200, "explain_p95_ms": 600, "counterfactual_p95_ms": 300},
        "pass": {
            "predict": pct(predict_ms, 0.95) < 200,
            "explain": pct(explain_ms, 0.95) < 600,
            "counterfactual": pct(cf_ms, 0.95) < 300,
        },
    }
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "bench_latency.json").write_text(json.dumps(out, indent=2), encoding="utf-8")

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()