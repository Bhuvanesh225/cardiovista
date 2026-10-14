"""Versioned API router (/v1)."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import JSONResponse

from ..features import FEATURES, default_inputs
from ..guard import GuardError, fill_defaults, validate_payload
from ..model import get_model
from ..ood import OODDetector

router = APIRouter(prefix="/v1", tags=["v1"])

ARTIFACTS = Path(__file__).resolve().parent.parent.parent / "artifacts"
PRESETS_PATH = Path(__file__).resolve().parent.parent / "presets.json"

_ood = OODDetector()
_metrics_cache: dict[str, Any] | None = None


def _load_metrics() -> dict[str, Any]:
    global _metrics_cache
    if _metrics_cache is None:
        path = ARTIFACTS / "metrics.json"
        _metrics_cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return _metrics_cache


def _predict_row(row: dict[str, Any]) -> dict[str, Any]:
    model = get_model()
    probs = model.predict_proba(row)
    is_ood = _ood.score(row)
    return {"probs": probs, "ood": is_ood}


@router.get("/health")
def health() -> dict[str, Any]:
    t0 = time.perf_counter()
    model = get_model()
    return {
        "status": "ok",
        "model_hash": model.registry.get("model_hash"),
        "mesh_sha": model.registry.get("mesh_sha"),
        "heads": list(model.heads.keys()),
        "server_ms": round((time.perf_counter() - t0) * 1000, 2),
    }


@router.get("/features")
def features() -> dict[str, Any]:
    return {"features": FEATURES, "defaults": default_inputs()}


@router.get("/presets")
def presets() -> dict[str, Any]:
    if PRESETS_PATH.exists():
        return json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
    return {"presets": []}


@router.get("/model-info")
def model_info() -> dict[str, Any]:
    model = get_model()
    reg = model.registry
    full = _load_metrics()
    heads_full: dict[str, Any] = {}
    for h in ("cad", "lad", "lcx", "rca"):
        m = (full.get("heads", {}).get(h, {}) if full else {}) or {}
        heads_full[h] = {
            "threshold": m.get("youden", reg.get("thresholds", {}).get(h)),
            "brier": m.get("brier", reg.get("brier", {}).get(h)),
            "brier_sigmoid": m.get("brier_sigmoid"),
            "brier_isotonic": m.get("brier_isotonic"),
            "ece": m.get("ece", reg.get("ece", {}).get(h)),
            "roc_auc": m.get("roc_auc", reg.get("roc_auc", {}).get(h)),
            "roc_ci": m.get("roc_ci"),
            "pr_auc": m.get("pr_auc", reg.get("pr_auc", {}).get(h)),
            "cv_auc_mean": m.get("cv_auc_mean", reg.get("cv_auc_mean", {}).get(h)),
            "cv_auc_sd": m.get("cv_auc_sd", reg.get("cv_auc_sd", {}).get(h)),
            "cv_fits": m.get("cv_fits", 25),
            "sensitivity_at_youden": m.get("sensitivity_at_youden"),
            "confusion_youden": m.get("confusion_youden"),
            "confusion_0.5": m.get("confusion_0.5"),
            "n_pos": m.get("n_pos"),
            "calibration": m.get("calibration", reg.get("calibration", {}).get(h)),
        }
    return {
        "model_hash": reg.get("model_hash"),
        "mesh_sha": reg.get("mesh_sha"),
        "mesh_name": reg.get("mesh_name"),
        "trained_at": reg.get("trained_at"),
        "seed": reg.get("seed", 42),
        "thresholds": {k: v["threshold"] for k, v in model.heads.items()},
        "brier": {k: v["brier"] for k, v in model.heads.items()},
        "calibration": {k: v["calibration"] for k, v in model.heads.items()},
        "ece": reg.get("ece"),
        "roc_auc": reg.get("roc_auc"),
        "pr_auc": reg.get("pr_auc"),
        "cv_auc_mean": reg.get("cv_auc_mean"),
        "cv_auc_sd": reg.get("cv_auc_sd"),
        "n_train_rows": reg.get("n_train_rows"),
        "heads": heads_full,
    }


@router.get("/metrics")
def metrics() -> dict[str, Any]:
    return _load_metrics()


@router.post("/predict")
def predict(request: Request, payload: dict[str, Any] = Body(...)) -> Any:
    t0 = time.perf_counter()
    try:
        clean = validate_payload(payload)
    except GuardError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message, "field": exc.field})

    model = get_model()
    row = fill_defaults(clean, model.defaults)
    result = _predict_row(row)
    result["inputs_used"] = row
    result["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return result


@router.post("/explain")
def explain(payload: dict[str, Any] = Body(...)) -> Any:
    t0 = time.perf_counter()
    target = payload.get("target", "cad")
    raw = payload.get("inputs", payload)
    if target not in ("cad", "lad", "lcx", "rca"):
        raise HTTPException(status_code=422, detail={"code": "target", "message": "target must be cad/lad/lcx/rca"})
    try:
        clean = validate_payload({k: v for k, v in raw.items() if k != "target"})
    except GuardError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message, "field": exc.field})

    model = get_model()
    row = fill_defaults(clean, model.defaults)
    result = model.explain(row, head_name=target, top_k=8)
    result["base_value"] = result.get("base_value")
    result["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return result


@router.post("/counterfactual")
def counterfactual(payload: dict[str, Any] = Body(...)) -> Any:
    """Live guardrailed counterfactual.

    Body: { "inputs": {...}, "target": "cad", "mods": {"BP": 120, "Current Smoker": 0} }
    Clamps every modification to the range chips; refuses forbidden fields.
    """
    t0 = time.perf_counter()
    inputs = payload.get("inputs", {})
    mods = payload.get("mods", {})
    target = payload.get("target", "cad")
    try:
        clean = validate_payload(inputs)
        clean_mods = validate_payload(mods)
    except GuardError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message, "field": exc.field})

    model = get_model()
    base_row = fill_defaults(clean, model.defaults)
    new_row = fill_defaults({**clean, **clean_mods}, model.defaults)

    base = model.predict_proba(base_row)
    after = model.predict_proba(new_row)
    is_ood = _ood.score(new_row)

    deltas = {
        head: {
            "before": base[head]["p"],
            "after": after[head]["p"],
            "delta_pp": round((after[head]["p"] - base[head]["p"]) * 100, 1),
        }
        for head in ("cad", "lad", "lcx", "rca")
    }
    rec = {k: v for k, v in deltas.items()}
    return {
        "target": target,
        "deltas": rec,
        "combined_delta_pp": rec[target]["delta_pp"],
        "ood": is_ood,
        "export_blocked": bool(is_ood),
        "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
    }