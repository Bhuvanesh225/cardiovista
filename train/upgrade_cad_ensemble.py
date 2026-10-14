"""Surgical CAD upgrade: tuned-XGB + L2-logreg averaged-raw ensemble.

Keeps LAD/LCX/RCA heads untouched. Replaces only the CAD head in
app/models/models.joblib with an EnsembleHead, recomputes honest repeated-CV
metrics for CAD (repeats=3, bootstrap=500, nested calibration on the averaged
raw scores), refreshes metrics.json / registry.json / presets.json and the CAD
figures. No Optuna (reuses the frozen tuned XGB params from the bundle).

    python train/upgrade_cad_ensemble.py

ETA on laptop CPU: ~2-4 min.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import importlib.util
import json
import sys
import time
import warnings
from pathlib import Path

import joblib
import numpy as np

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location("cv_train", ROOT / "train" / "train.py")
assert _spec and _spec.loader
T = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(T)

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

from app.preprocess import FastPre, make_preprocessor

REPEATS = 3
BOOTSTRAP = 500
SEED = 42


def make_lr_pipe():
    return Pipeline(
        [
            ("pre", make_preprocessor(T.NUMERIC + T.BINARY, T.CATEGORICAL)),
            ("clf", LogisticRegression(max_iter=2000, C=1.0)),
        ]
    )


def nested_ensemble_oof(X, y, xgb_params, seed):
    """One repeat of nested-calibrated ensemble OOF (mirrors repeated_cv)."""
    from sklearn.isotonic import IsotonicRegression
    from sklearn.linear_model import LogisticRegression as LR

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    oof = np.full(len(y), np.nan)
    for tr, va in skf.split(X, y):
        px = T.make_base(xgb_params)
        px.fit(X.iloc[tr], y[tr])
        pl = make_lr_pipe()
        pl.fit(X.iloc[tr], y[tr])
        raw_va = (px.predict_proba(X.iloc[va])[:, 1] + pl.predict_proba(X.iloc[va])[:, 1]) / 2.0

        inner = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
        inner_raw = np.full(len(tr), np.nan)
        for itr, iva in inner.split(X.iloc[tr], y[tr]):
            qx = T.make_base(xgb_params)
            qx.fit(X.iloc[tr].iloc[itr], y[tr][itr])
            ql = make_lr_pipe()
            ql.fit(X.iloc[tr].iloc[itr], y[tr][itr])
            inner_raw[iva] = (
                qx.predict_proba(X.iloc[tr].iloc[iva])[:, 1]
                + ql.predict_proba(X.iloc[tr].iloc[iva])[:, 1]
            ) / 2.0
        lr = LR(C=1e6, solver="lbfgs", max_iter=1000).fit(T._logit(inner_raw).reshape(-1, 1), y[tr])
        from sklearn.isotonic import IsotonicRegression as IR

        iso = IR(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(inner_raw, y[tr])
        p_sig = lr.predict_proba(T._logit(raw_va).reshape(-1, 1))[:, 1]
        p_iso = iso.predict(raw_va)
        b_sig = brier_score_loss(y[va], np.clip(p_sig, 0, 1))
        b_iso = brier_score_loss(y[va], np.clip(p_iso, 0, 1))
        use_iso = (int(y[tr].sum()) >= 100) or (b_iso < b_sig - 0.003)
        oof[va] = np.clip(p_iso if use_iso else p_sig, 0, 1)
    return oof


def main():
    t0 = time.time()
    bundle_path = ROOT / "app" / "models" / "models.joblib"
    bundle = joblib.load(bundle_path)
    old_cad = bundle["heads"]["cad"]
    xgb_params = dict(old_cad.get("params", {}))
    print(f"[cad] tuned XGB params: {xgb_params}", flush=True)

    df = T.load_frame()
    df.columns = [str(c).strip() for c in df.columns]
    X, y = T.build_xy(df, "cad")
    print(f"[cad] n={len(y)} pos={int(y.sum())} repeats={REPEATS}", flush=True)

    aucs, oofs = [], []
    for r in range(REPEATS):
        oof = nested_ensemble_oof(X, y, xgb_params, SEED + r)
        from sklearn.metrics import roc_auc_score

        aucs.append(roc_auc_score(y, oof))
        oofs.append(oof)
        print(f"[cad] repeat {r+1}/{REPEATS} AUC={aucs[-1]:.4f} ({time.time()-t0:.0f}s)", flush=True)

    oof_mean = np.mean(np.vstack(oofs), axis=0)
    m = T.compute_metrics("cad", y, oof_mean, BOOTSTRAP)
    m["cv_auc_mean"] = round(float(np.mean(aucs)), 4)
    m["cv_auc_sd"] = round(float(np.std(aucs)), 4)
    m["cv_fits"] = int(len(aucs) * 5)
    m["n_pos"] = int(y.sum())

    # --- served ensemble refit on full data (same nested recipe) ---
    from sklearn.isotonic import IsotonicRegression
    from sklearn.linear_model import LogisticRegression as LR

    base_xgb = T.make_base(xgb_params)
    base_xgb.fit(X, y)
    pipe_lr = make_lr_pipe()
    pipe_lr.fit(X, y)

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    oof_raw = np.full(len(y), np.nan)
    for tr, va in skf.split(X, y):
        qx = T.make_base(xgb_params)
        qx.fit(X.iloc[tr], y[tr])
        ql = make_lr_pipe()
        ql.fit(X.iloc[tr], y[tr])
        oof_raw[va] = (
            qx.predict_proba(X.iloc[va])[:, 1] + ql.predict_proba(X.iloc[va])[:, 1]
        ) / 2.0
    lr = LR(C=1e6, solver="lbfgs", max_iter=1000).fit(T._logit(oof_raw).reshape(-1, 1), y)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(oof_raw, y)
    p_sig = lr.predict_proba(T._logit(oof_raw).reshape(-1, 1))[:, 1]
    p_iso = iso.predict(oof_raw)
    b_sig = float(brier_score_loss(y, np.clip(p_sig, 0, 1)))
    b_iso = float(brier_score_loss(y, np.clip(p_iso, 0, 1)))
    use_iso = (int(y.sum()) >= 100) or (b_iso < b_sig - 0.003)

    from app.calibration import EnsembleHead

    fast = FastPre(base_xgb.named_steps["pre"], T.NUMERIC + T.BINARY, T.CATEGORICAL)
    head = EnsembleHead(
        base_xgb.named_steps["pre"],
        base_xgb.named_steps["clf"],
        pipe_lr,
        "isotonic" if use_iso else "sigmoid",
        iso if use_iso else lr,
        fast=fast,
    )
    Xt = base_xgb.named_steps["pre"].transform(X)
    from sklearn.cluster import KMeans

    km = KMeans(n_clusters=min(50, len(Xt)), n_init=4, random_state=SEED).fit(Xt)
    med_idx = []
    for c in range(km.n_clusters):
        members = np.where(km.labels_ == c)[0]
        if len(members):
            med_idx.append(int(members[0]))

    m["calibration"] = "isotonic" if use_iso else "sigmoid"
    m["brier_sigmoid"] = round(b_sig, 4)
    m["brier_isotonic"] = round(b_iso, 4)

    bundle["heads"]["cad"] = {
        "clf": head,
        "base_pipe": base_xgb,  # XGB leg stays the SHAP source (TreeExplainer-compatible)
        "calibration": m["calibration"],
        "threshold": m["youden"],
        "brier": m["brier"],
        "ece": m.get("ece"),
        "ci_pm": round((m["roc_ci"][1] - m["roc_ci"][0]) / 4, 4),
        "shap_background": Xt[med_idx],
        "shap_sources": T.shap_source_map(base_xgb.named_steps["pre"]),
        "params": {**xgb_params, "_ensemble": "xgb+logreg-C1.0-mean"},
    }
    joblib.dump(bundle, bundle_path, compress=3)
    model_hash = hashlib.sha256(bundle_path.read_bytes()).hexdigest()

    # --- metrics.json (CAD entry only) ---
    mp = ROOT / "artifacts" / "metrics.json"
    metrics = json.loads(mp.read_text(encoding="utf-8"))
    old = metrics["heads"]["cad"]
    metrics["heads"]["cad"] = m
    metrics["model_hash"] = model_hash
    metrics["generated_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    mp.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    # --- registry.json (CAD fields + model hash) ---
    rp = ROOT / "app" / "registry.json"
    reg = json.loads(rp.read_text(encoding="utf-8"))
    reg["model_hash"] = model_hash
    reg["trained_at"] = metrics["generated_at"]
    for k in ("thresholds", "brier", "calibration", "ece", "roc_auc", "pr_auc", "cv_auc_mean", "cv_auc_sd"):
        pass
    reg["thresholds"]["cad"] = m["youden"]
    reg["brier"]["cad"] = m["brier"]
    reg["calibration"]["cad"] = m["calibration"]
    reg["ece"]["cad"] = m["ece"]
    reg["roc_auc"]["cad"] = m["roc_auc"]
    reg["pr_auc"]["cad"] = m["pr_auc"]
    reg["cv_auc_mean"]["cad"] = m["cv_auc_mean"]
    reg["cv_auc_sd"]["cad"] = m["cv_auc_sd"]
    rp.write_text(json.dumps(reg, indent=2), encoding="utf-8")

    # --- CAD figures ---
    T.save_figures({"cad": {"metrics": m, "y": y, "p": oof_mean}})

    # --- presets refresh ---
    pp = ROOT / "app" / "presets.json"
    presets = json.loads(pp.read_text(encoding="utf-8"))
    from app.model import RiskModel

    rm = RiskModel(bundle_path)
    for p in presets["presets"]:
        probs = rm.predict_proba({**bundle.get("defaults", {}), **p["inputs"]})
        p["expected"] = {h: probs[h]["p"] for h in ("cad", "lad", "lcx", "rca")}
        p["flag"] = probs["cad"]["flag"]
    pp.write_text(json.dumps(presets, indent=2), encoding="utf-8")

    print(
        f"[cad] OLD AUC={old['roc_auc']} Brier={old['brier']} ECE={old['ece']} "
        f"-> NEW AUC={m['roc_auc']}[{m['roc_ci'][0]}-{m['roc_ci'][1]}] "
        f"Brier={m['brier']} ECE={m['ece']} Youden={m['youden']} "
        f"cv={m['cv_auc_mean']}±{m['cv_auc_sd']} ({m['calibration']})",
        flush=True,
    )
    print(f"[done] {time.time()-t0:.0f}s model_hash={model_hash[:16]}", flush=True)


if __name__ == "__main__":
    main()
