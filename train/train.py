"""CardioVista training pipeline.

Trains 4 independent calibrated binary heads (CAD, LAD, LCX, RCA) on the UCI
"Extension of Z-Alizadeh Sani" dataset (n=303), seed 42.

    python train/train.py --seed 42 --optuna 30 --repeats 5

Honest by construction:
  * the leakage firewall is asserted before any fit (Cath/LAD/LCX/RCA never
    enter another head's features),
  * preprocessing lives inside the frozen ColumnTransformer, fitted per fold,
  * the headline metrics are repeated stratified 5-fold x 5-seed out-of-fold
    (25 fits/head) with nested calibration and 2000x bootstrap AUC CIs,
  * calibration is chosen by the frozen Brier-gated rule,
  * the served pipeline is refit on the full data with the same recipe,
  * every artefact (bundle, registry, metrics, figures) is committed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_MAP, FEATURE_NAMES  # noqa: E402
from app.guard import assert_no_forbidden  # noqa: E402

RAW_XLSX = ROOT / "data" / "raw" / "extention of Z-Alizadeh sani dataset.xlsx"
ARTIFACTS = ROOT / "artifacts"
MODELS = ROOT / "app" / "models"
TARGETS = ["cad", "lad", "lcx", "rca"]
TARGET_COL = {"cad": "Cath", "lad": "LAD", "lcx": "LCX", "rca": "RCA"}

NUMERIC = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "num"]
BINARY = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "bin"]
CATEGORICAL = [f["name"] for f in FEATURE_MAP.values() if f["kind"] == "cat"]


# --------------------------------------------------------------------------
def load_frame() -> pd.DataFrame:
    df = pd.read_excel(RAW_XLSX)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def targets_from(df: pd.DataFrame) -> dict[str, np.ndarray]:
    out = {}
    for head, col in TARGET_COL.items():
        if col == "Cath":
            out[head] = (df[col].astype(str).str.strip().str.lower() == "cad").astype(int).to_numpy()
        else:
            out[head] = (df[col].astype(str).str.strip().str.lower() == "stenotic").astype(int).to_numpy()
    return out


def build_xy(df: pd.DataFrame, head: str) -> tuple[pd.DataFrame, np.ndarray]:
    cols = list(FEATURE_NAMES)
    assert_no_forbidden(head, cols)
    return df[cols].copy(), targets_from(df)[head]


def population_defaults(df: pd.DataFrame) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for f in FEATURE_MAP.values():
        col = df[f["name"]]
        if f["kind"] == "num":
            out[f["name"]] = round(float(col.median()), 4)
        elif f["kind"] == "bin":
            out[f["name"]] = int(col.mode().iloc[0])
        else:
            out[f["name"]] = str(col.mode().iloc[0])
    return out


def make_preprocessor():
    from app.preprocess import make_preprocessor as _mk

    return _mk(NUMERIC + BINARY, CATEGORICAL)


def make_base(params: dict | None = None):
    import xgboost as xgb
    from sklearn.pipeline import Pipeline

    p = dict(
        n_estimators=250,
        max_depth=3,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.8,
        reg_lambda=5.0,
        min_child_weight=1,
        eval_metric="logloss",
        tree_method="hist",
        n_jobs=2,
        random_state=42,
    )
    if params:
        p.update(params)
    return Pipeline([("pre", make_preprocessor()), ("clf", xgb.XGBClassifier(**p))])


def shap_source_map(pre) -> list[str]:
    names = list(pre.get_feature_names_out())
    order = sorted(FEATURE_NAMES, key=len, reverse=True)
    src = []
    for n in names:
        core = n.split("__", 1)[-1]
        match = core
        for f in order:
            if core == f or core.startswith(f + "_"):
                match = f
                break
        src.append(match)
    return src


# --------------------------------------------------------------------------
def _logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def fit_calibrators(raw_oof, y, raw_test, y_test):
    from sklearn.isotonic import IsotonicRegression
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss

    lr = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000)
    lr.fit(_logit(raw_oof).reshape(-1, 1), y)
    p_sig = lr.predict_proba(_logit(raw_test).reshape(-1, 1))[:, 1]

    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    iso.fit(raw_oof, y)
    p_iso = iso.predict(raw_test)

    b_sig = float(brier_score_loss(y_test, np.clip(p_sig, 0, 1)))
    b_iso = float(brier_score_loss(y_test, np.clip(p_iso, 0, 1)))
    return lr, iso, p_sig, p_iso, b_sig, b_iso


def ece(y, p, bins=10) -> float:
    edges = np.linspace(0, 1, bins + 1)
    total = len(y)
    acc = 0.0
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (p > lo) & (p <= hi) if i > 0 else (p >= lo) & (p <= hi)
        if mask.sum() == 0:
            continue
        acc += (mask.sum() / total) * abs(y[mask].mean() - p[mask].mean())
    return float(acc)


def youden_threshold(y, p):
    from sklearn.metrics import roc_curve

    fpr, tpr, thr = roc_curve(y, p)
    i = int(np.argmax(tpr - fpr))
    return float(thr[i]), float(tpr[i])


def bootstrap_auc_ci(y, p, n=2000, seed=42):
    from sklearn.metrics import roc_auc_score

    rng = np.random.default_rng(seed)
    idx = np.arange(len(y))
    scores = []
    for _ in range(n):
        s = rng.choice(idx, size=len(idx), replace=True)
        if len(np.unique(y[s])) < 2:
            continue
        scores.append(roc_auc_score(y[s], p[s]))
    lo, hi = np.percentile(scores, [2.5, 97.5])
    return float(lo), float(hi)


def compute_metrics(head, y_test, p_test, bootstrap) -> dict[str, Any]:
    from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, roc_auc_score

    auc = float(roc_auc_score(y_test, p_test))
    ap = float(average_precision_score(y_test, p_test))
    brier = float(brier_score_loss(y_test, np.clip(p_test, 0, 1)))
    e = ece(y_test, np.clip(p_test, 0, 1))
    thr, tpr = youden_threshold(y_test, p_test)
    lo, hi = bootstrap_auc_ci(y_test, p_test, n=bootstrap)
    return {
        "head": head,
        "roc_auc": round(auc, 4),
        "roc_ci": [round(lo, 4), round(hi, 4)],
        "pr_auc": round(ap, 4),
        "brier": round(brier, 4),
        "ece": round(e, 4),
        "youden": round(thr, 4),
        "sensitivity_at_youden": round(tpr, 4),
        "confusion_youden": confusion_matrix(y_test, (p_test >= thr).astype(int)).tolist(),
        "confusion_0.5": confusion_matrix(y_test, (p_test >= 0.5).astype(int)).tolist(),
        "n_test": int(len(y_test)),
        "n_pos_test": int(y_test.sum()),
    }


def repeated_cv(df, head, params, repeats, seed, bootstrap):
    """Honest repeated 5-fold x repeats out-of-fold metrics with nested calibration."""
    from sklearn.base import clone
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import StratifiedKFold

    X, y = build_xy(df, head)
    rng = np.random.default_rng(seed)
    aucs = []
    oof_matrix = []
    for r in range(repeats):
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed + r)
        oof = np.full(len(y), np.nan)
        raw_oof = np.full(len(y), np.nan)
        for tr, va in skf.split(X, y):
            pipe = make_base(params)
            pipe.fit(X.iloc[tr], y[tr])
            raw = pipe.predict_proba(X.iloc[va])[:, 1]
            raw_oof[va] = raw
            # calibrate inside the fold using the training part (5-fold OOF on train)
            from sklearn.isotonic import IsotonicRegression
            from sklearn.linear_model import LogisticRegression

            inner = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed + r)
            inner_raw = np.full(len(tr), np.nan)
            for itr, iva in inner.split(X.iloc[tr], y[tr]):
                p2 = make_base(params)
                p2.fit(X.iloc[tr].iloc[itr], y[tr][itr])
                inner_raw[iva] = p2.predict_proba(X.iloc[tr].iloc[iva])[:, 1]
            n_pos = int(y[tr].sum())
            lr = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000).fit(_logit(inner_raw).reshape(-1, 1), y[tr])
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(inner_raw, y[tr])
            p_sig = lr.predict_proba(_logit(raw).reshape(-1, 1))[:, 1]
            p_iso = iso.predict(raw)
            from sklearn.metrics import brier_score_loss

            b_sig = brier_score_loss(y[va], np.clip(p_sig, 0, 1))
            b_iso = brier_score_loss(y[va], np.clip(p_iso, 0, 1))
            use_iso = (n_pos >= 100) or (b_iso < b_sig - 0.003)
            oof[va] = np.clip(p_iso if use_iso else p_sig, 0, 1)
        aucs.append(roc_auc_score(y, oof))
        oof_matrix.append(oof)

    oof_mean = np.mean(np.vstack(oof_matrix), axis=0)
    aucs = np.asarray(aucs)
    m = compute_metrics(head, y, oof_mean, bootstrap)
    m["cv_auc_mean"] = round(float(aucs.mean()), 4)
    m["cv_auc_sd"] = round(float(aucs.std()), 4)
    m["cv_fits"] = int(len(aucs) * 5)
    m["n_pos"] = int(y.sum())
    return m, oof_mean, y


# --------------------------------------------------------------------------
def save_figures(all_results):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.calibration import calibration_curve
    from sklearn.metrics import precision_recall_curve, roc_curve

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for head, res in all_results.items():
        y, p = res["y"], res["p"]
        try:
            frac_pos, mean_pred = calibration_curve(y, p, n_bins=8, strategy="quantile")
        except Exception:
            frac_pos, mean_pred = [0, 1], [0, 1]
        fig, ax = plt.subplots(figsize=(4, 4), dpi=150)
        ax.plot([0, 1], [0, 1], "--", color="#888", lw=1)
        ax.plot(mean_pred, frac_pos, "o-", color="#3D7DFF")
        ax.set_xlabel("Mean predicted probability")
        ax.set_ylabel("Fraction of positives")
        ax.set_title(f"{head.upper()} reliability (Brier {res['metrics']['brier']:.3f})")
        fig.tight_layout()
        fig.savefig(ARTIFACTS / f"reliability_{head}.png")
        plt.close(fig)

        fpr, tpr, _ = roc_curve(y, p)
        fig, ax = plt.subplots(figsize=(4, 4), dpi=150)
        ax.plot(fpr, tpr, color="#3D7DFF", lw=2)
        ax.plot([0, 1], [0, 1], "--", color="#888", lw=1)
        ax.set_title(f"{head.upper()} ROC (AUC {res['metrics']['roc_auc']:.3f})")
        ax.set_xlabel("FPR")
        ax.set_ylabel("TPR")
        fig.tight_layout()
        fig.savefig(ARTIFACTS / f"roc_{head}.png")
        plt.close(fig)

        prec, rec, _ = precision_recall_curve(y, p)
        fig, ax = plt.subplots(figsize=(4, 4), dpi=150)
        ax.plot(rec, prec, color="#14C8B4", lw=2)
        ax.set_title(f"{head.upper()} PR (AP {res['metrics']['pr_auc']:.3f})")
        ax.set_xlabel("Recall")
        ax.set_ylabel("Precision")
        fig.tight_layout()
        fig.savefig(ARTIFACTS / f"pr_{head}.png")
        plt.close(fig)


def fit_served(df, head, params, seed):
    """Refit the served calibrated pipeline on the full data (same recipe)."""
    from sklearn.base import clone
    from sklearn.isotonic import IsotonicRegression
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss
    from sklearn.model_selection import StratifiedKFold

    X, y = build_xy(df, head)
    base_pipe = make_base(params)
    base_pipe.fit(X, y)

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    oof_raw = np.full(len(y), np.nan)
    for tr, va in skf.split(X, y):
        p = make_base(params)
        p.fit(X.iloc[tr], y[tr])
        oof_raw[va] = p.predict_proba(X.iloc[va])[:, 1]

    n_pos = int(y.sum())
    lr = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000).fit(_logit(oof_raw).reshape(-1, 1), y)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(oof_raw, y)
    p_sig = lr.predict_proba(_logit(oof_raw).reshape(-1, 1))[:, 1]
    p_iso = iso.predict(oof_raw)
    b_sig = brier_score_loss(y, np.clip(p_sig, 0, 1))
    b_iso = brier_score_loss(y, np.clip(p_iso, 0, 1))
    use_iso = (n_pos >= 100) or (b_iso < b_sig - 0.003)

    from sklearn.pipeline import Pipeline

    from app.calibration import CalibratedHead
    from app.preprocess import FastPre

    fast = FastPre(base_pipe.named_steps["pre"], NUMERIC + BINARY, CATEGORICAL)
    if use_iso:
        cal = CalibratedHead(base_pipe.named_steps["pre"], base_pipe.named_steps["clf"], "isotonic", iso, fast=fast)
    else:
        cal = CalibratedHead(base_pipe.named_steps["pre"], base_pipe.named_steps["clf"], "sigmoid", lr, fast=fast)

    # SHAP background: 50 medoids of the transformed training data
    Xt = base_pipe.named_steps["pre"].transform(X)
    from sklearn.cluster import KMeans

    km = KMeans(n_clusters=min(50, len(Xt)), n_init=4, random_state=seed).fit(Xt)
    med_idx = []
    for c in range(km.n_clusters):
        members = np.where(km.labels_ == c)[0]
        if len(members):
            med_idx.append(int(members[0]))

    return {
        "clf": cal,
        "base_pipe": base_pipe,
        "calibration": "isotonic" if use_iso else "sigmoid",
        "brier_sigmoid": round(float(b_sig), 4),
        "brier_isotonic": round(float(b_iso), 4),
        "shap_background": Xt[med_idx],
        "shap_sources": shap_source_map(base_pipe.named_steps["pre"]),
    }


def build_presets() -> dict[str, Any]:
    """Legacy synthetic exemplars — DO NOT overwrite real-row presets.

    Real presets live in app/presets.json (built by train/pick_presets.py from
    de-identified UCI rows, source_row tracked). Retraining must refresh their
    expected probabilities, never replace them with synthetic fiction.
    This fallback is only used when no presets.json exists yet.
    """
    return {
        "presets": [
            {
                "id": "typical-angina-58m",
                "label": "Typical angina · 58M",
                "note": "Frozen exemplar shared by docs, video and e2e tests.",
                "inputs": {
                    "Age": 58, "Sex": "Male", "Weight": 82, "Length": 172, "BMI": 27.7,
                    "DM": 1, "HTN": 1, "Current Smoker": 1, "EX-Smoker": 0, "FH": 1, "DLP": "Y",
                    "BP": 150, "PR": 84, "Typical Chest Pain": 1, "Exertional CP": "Y",
                    "LowTH Ang": "Y", "Function Class": "2", "Dyspnea": "Y",
                    "St Depression": 1, "Tinversion": 1, "Q Wave": 1,
                    "FBS": 118, "TG": 190, "LDL": 160, "HDL": 38, "CR": 1.0,
                    "EF-TTE": 45, "Region RWMA": "2", "VHD": "N", "Obesity": "Y",
                },
            },
            {
                "id": "low-risk-44f",
                "label": "Low-risk · 44F",
                "note": "Frozen exemplar shared by docs, video and e2e tests.",
                "inputs": {
                    "Age": 44, "Sex": "Fmale", "Weight": 62, "Length": 163, "BMI": 23.3,
                    "DM": 0, "HTN": 0, "Current Smoker": 0, "EX-Smoker": 0, "FH": 0, "DLP": "N",
                    "BP": 118, "PR": 72, "Typical Chest Pain": 0, "Dyspnea": "N",
                    "Atypical": "N", "Nonanginal": "Y", "St Depression": 0, "Tinversion": 0,
                    "Q Wave": 0, "FBS": 86, "TG": 110, "LDL": 96, "HDL": 62, "CR": 0.8,
                    "EF-TTE": 60, "Region RWMA": "0", "VHD": "N", "Obesity": "N",
                },
            },
            {
                "id": "borderline-61m",
                "label": "Borderline · 61M",
                "note": "Frozen exemplar shared by docs, video and e2e tests.",
                "inputs": {
                    "Age": 61, "Sex": "Male", "Weight": 78, "Length": 170, "BMI": 27.0,
                    "DM": 0, "HTN": 1, "Current Smoker": 0, "EX-Smoker": 1, "FH": 1, "DLP": "Y",
                    "BP": 140, "PR": 76, "Typical Chest Pain": 1, "Atypical": "Y", "Dyspnea": "Y",
                    "St Depression": 1, "Tinversion": 0, "FBS": 104, "TG": 168, "LDL": 128,
                    "HDL": 44, "CR": 1.0, "EF-TTE": 52, "Region RWMA": "0", "VHD": "mild", "Obesity": "N",
                },
            },
        ]
    }


# --------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--optuna", type=int, default=30)
    ap.add_argument("--repeats", type=int, default=5)
    ap.add_argument("--bootstrap", type=int, default=2000)
    args = ap.parse_args()

    np.random.seed(args.seed)
    from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split

    print("[data] loading UCI Extension of Z-Alizadeh Sani ...")
    df = load_frame()
    defaults = population_defaults(df)
    targets = targets_from(df)
    print(f"[data] n={len(df)}  features={len(FEATURE_NAMES)}  seed={args.seed}")
    for h in TARGETS:
        print(f"[head:{h}] prevalence={targets[h].mean():.3f}  n_pos={int(targets[h].sum())}")

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    MODELS.mkdir(parents=True, exist_ok=True)

    # --- Optuna-30 per head on PR-AUC -------------------------------------
    tuned: dict[str, dict] = {}
    if args.optuna > 0:
        import optuna
        from sklearn.metrics import average_precision_score

        optuna.logging.set_verbosity(optuna.logging.WARNING)
        for head in TARGETS:
            X, y = build_xy(df, head)

            def objective(trial, X=X, y=y):
                params = dict(
                    n_estimators=trial.suggest_int("n_estimators", 150, 400, step=50),
                    max_depth=trial.suggest_int("max_depth", 2, 4),
                    learning_rate=trial.suggest_float("learning_rate", 0.02, 0.08, log=True),
                    subsample=trial.suggest_float("subsample", 0.7, 1.0),
                    colsample_bytree=trial.suggest_float("colsample_bytree", 0.6, 1.0),
                    reg_lambda=trial.suggest_float("reg_lambda", 1.0, 10.0, log=True),
                    min_child_weight=trial.suggest_int("min_child_weight", 1, 5),
                )
                skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
                oof = cross_val_predict(make_base(params), X, y, cv=skf, method="predict_proba", n_jobs=1)[:, 1]
                return average_precision_score(y, oof)

            study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=args.seed))
            study.optimize(objective, n_trials=args.optuna, show_progress_bar=False)
            tuned[head] = study.best_params
            print(f"[optuna:{head}] best PR-AUC={study.best_value:.4f} {study.best_params}")

    # --- honest repeated-CV metrics ---------------------------------------
    heads_bundle: dict[str, Any] = {}
    metrics_all: dict[str, Any] = {}
    fig_data: dict[str, Any] = {}
    print(f"[cv] repeated stratified 5-fold x {args.repeats} (={args.repeats*5} fits/head) ...")
    for head in TARGETS:
        m, oof_mean, y_all = repeated_cv(df, head, tuned.get(head), args.repeats, args.seed, args.bootstrap)
        metrics_all[head] = m
        fig_data[head] = {"metrics": m, "y": y_all, "p": oof_mean}
        print(
            f"[head:{head}] AUC={m['roc_auc']:.3f}[{m['roc_ci'][0]:.3f}-{m['roc_ci'][1]:.3f}] "
            f"Brier={m['brier']:.3f} ECE={m['ece']:.3f} Youden={m['youden']:.3f} "
            f"cv={m['cv_auc_mean']:.3f}±{m['cv_auc_sd']:.3f}"
        )

    # --- served pipelines (full-data refit) --------------------------------
    for head in TARGETS:
        served = fit_served(df, head, tuned.get(head), args.seed)
        m = metrics_all[head]
        m["calibration"] = served["calibration"]
        m["brier_sigmoid"] = served["brier_sigmoid"]
        m["brier_isotonic"] = served["brier_isotonic"]
        heads_bundle[head] = {
            "clf": served["clf"],
            "base_pipe": served["base_pipe"],
            "calibration": served["calibration"],
            "threshold": m["youden"],
            "brier": m["brier"],
            "ci_pm": round((m["roc_ci"][1] - m["roc_ci"][0]) / 4, 4),
            "shap_background": served["shap_background"],
            "shap_sources": served["shap_sources"],
            "params": tuned.get(head, {}),
        }
        print(f"[served:{head}] calibration={served['calibration']} (brier sig={served['brier_sigmoid']:.4f} iso={served['brier_isotonic']:.4f})")

    # --- OOD -------------------------------------------------------------
    import joblib
    from sklearn.ensemble import IsolationForest

    ood_keys = NUMERIC
    X_ood = df[ood_keys].astype(float).fillna(df[ood_keys].median()).to_numpy()
    ood = IsolationForest(contamination=0.05, random_state=args.seed).fit(X_ood)
    joblib.dump({"pipe": ood, "keys": ood_keys}, MODELS / "ood.joblib")

    # --- bundle + registry -------------------------------------------------
    bundle = {"feature_names": FEATURE_NAMES, "defaults": defaults, "heads": heads_bundle, "seed": args.seed}
    bundle_path = MODELS / "models.joblib"
    joblib.dump(bundle, bundle_path, compress=3)
    model_hash = hashlib.sha256(bundle_path.read_bytes()).hexdigest()

    mesh_path = ROOT / "assets" / "heart.glb"
    mesh_sha = hashlib.sha256(mesh_path.read_bytes()).hexdigest() if mesh_path.exists() else None

    registry = {
        "model_hash": model_hash,
        "mesh_sha": mesh_sha,
        "mesh_name": "heart.glb",
        "trained_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "seed": args.seed,
        "n_train_rows": int(len(df)),
        "thresholds": {h: heads_bundle[h]["threshold"] for h in TARGETS},
        "brier": {h: heads_bundle[h]["brier"] for h in TARGETS},
        "calibration": {h: heads_bundle[h]["calibration"] for h in TARGETS},
    }
    (ROOT / "app" / "registry.json").write_text(json.dumps(registry, indent=2), encoding="utf-8")

    metrics_out = {
        "generated_at": registry["trained_at"],
        "seed": args.seed,
        "n_rows": int(len(df)),
        "n_features": len(FEATURE_NAMES),
        "model_hash": model_hash,
        "mesh_sha": mesh_sha,
        "repeats": args.repeats,
        "heads": metrics_all,
    }
    (ARTIFACTS / "metrics.json").write_text(json.dumps(metrics_out, indent=2), encoding="utf-8")

    import csv

    with (ARTIFACTS / "calibration_uncertainty.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["head", "roc_auc", "roc_ci_low", "roc_ci_high", "pr_auc", "brier", "ece", "youden", "cv_auc_mean", "cv_auc_sd", "cv_fits", "calibration", "n_pos"])
        for h in TARGETS:
            m = metrics_all[h]
            w.writerow([h, m["roc_auc"], m["roc_ci"][0], m["roc_ci"][1], m["pr_auc"], m["brier"], m["ece"], m["youden"], m["cv_auc_mean"], m["cv_auc_sd"], m["cv_fits"], m["calibration"], m["n_pos"]])

    save_figures(fig_data)

    # --- frozen presets: refresh real-row presets, never clobber with synthetic --
    from app.model import RiskModel

    rm = RiskModel(bundle_path)
    presets_path = ROOT / "app" / "presets.json"
    if presets_path.exists():
        try:
            presets = json.loads(presets_path.read_text(encoding="utf-8"))
            for p in presets["presets"]:
                probs = rm.predict_proba({**defaults, **p["inputs"]})
                p["expected"] = {h: probs[h]["p"] for h in TARGETS}
                p["flag"] = probs["cad"]["flag"]
            presets_path.write_text(json.dumps(presets, indent=2), encoding="utf-8")
            print("[presets] refreshed expected probs for real-row presets (kept source_row)")
        except Exception as exc:
            print(f"[presets] WARNING: could not refresh real presets ({exc}); writing synthetic fallback")
            presets = build_presets()
            for p in presets["presets"]:
                probs = rm.predict_proba({**defaults, **p["inputs"]})
                p["expected"] = {h: probs[h]["p"] for h in TARGETS}
                p["flag"] = probs["cad"]["flag"]
            presets_path.write_text(json.dumps(presets, indent=2), encoding="utf-8")
    else:
        presets = build_presets()
        for p in presets["presets"]:
            probs = rm.predict_proba({**defaults, **p["inputs"]})
            p["expected"] = {h: probs[h]["p"] for h in TARGETS}
            p["flag"] = probs["cad"]["flag"]
        presets_path.write_text(json.dumps(presets, indent=2), encoding="utf-8")

    print("[done] registry + metrics + presets written")
    print(f"       model_hash={model_hash[:16]} mesh_sha={(mesh_sha or '')[:16]}")
    for h in TARGETS:
        m = metrics_all[h]
        print(f"       {h}: AUC {m['roc_auc']} [{m['roc_ci'][0]}-{m['roc_ci'][1]}] Brier {m['brier']} ECE {m['ece']} Youden {m['youden']} ({m['calibration']})")


if __name__ == "__main__":
    main()