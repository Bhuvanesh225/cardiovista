# CardioVista

**Educational coronary-artery-disease screening aid** — turns routine demographics,
symptoms, vitals, ECG, labs and echo into **calibrated four-head risk** (CAD + LAD/LCX/RCA
stenosis ≥ 50%), mapped live onto one anatomical 3D heart and explained with TreeSHAP.

> ⚠️ **Not a diagnostic device.** Educational screening aid only. No PHI is stored.
> Discuss amber or red results with a clinician.

---

## What's inside

| Layer | Stack |
|---|---|
| Frontend | Vite 5 · React 18 · TypeScript 5 · Tailwind · `@react-three/fiber` · drei · zustand |
| Backend | FastAPI · pydantic v2 (`extra="forbid"`) · joblib |
| Model | 4× XGBoost binaries → sigmoid/isotonic calibration (scikit-learn) · TreeSHAP |
| Train | Optuna · pandas · matplotlib (artefacts only) |
| Assets | one frozen BodyParts3D mesh (`heart_bp3d.glb`, 33,578 tris) |

## Repository layout

```
cardiovista/
├─ app/                     # FastAPI service
│  ├─ main.py               # app + startup hash-check
│  ├─ routers/v1.py         # /v1/predict /explain /counterfactual /metrics /health /model-info
│  ├─ guard.py              # leakage firewall + range chips + <18 + audit
│  ├─ ood.py                # IsolationForest OOD
│  ├─ model.py              # RiskModel adapter (predict_proba / explain)
│  ├─ calibration.py        # CalibratedHead (picklable)
│  ├─ preprocess.py         # Frozen ColumnTransformer + numpy FastPre
│  ├─ features.py           # the 55 allowed inputs (single source of truth)
│  ├─ registry.json         # {model_hash, mesh_sha, thresholds, brier}
│  └─ presets.json          # frozen 58M / 44F / 61M exemplars
├─ train/                   # training + benchmarks (seed 42)
│  ├─ train.py  bench_latency.py
├─ web/                     # Vite + React + R3F dashboard
│  ├─ src/HeartScene.tsx    # 3D heart, emissive/pulse, isolate/X-ray/presets
│  ├─ src/lib/vesselConfig.ts  # the SOLE prob → mesh correspondence
│  └─ src/components/…
├─ assets/heart_bp3d.glb + sha256.txt
├─ artifacts/               # metrics.json, roc/pr/reliability PNGs, bench_latency.json
├─ tests/                   # leakage, vessel-map, fastpre, api
└─ docs/                    # 6-page documentation
```

## Quickstart (CPU only)

```bash
# 1. Python environment
python -m venv .venv && . .venv/Scripts/activate      # Windows PowerShell
pip install -r requirements.txt

# 2. Train (seed 42, ~10 min CPU).  Downloads the UCI dataset on first run.
python train/train.py --seed 42 --optuna 30 --repeats 5

# 3. Serve the API
uvicorn app.main:app --port 8000

# 4. Frontend (proxies /v1 -> :8000)
cd web && npm install && npm run dev       # http://localhost:5173
```

The dataset is committed under `data/raw/` for offline runs; `train.py` will fetch it via
`ucimlrepo` if missing.

## API (versioned)

| Route | Method | Purpose |
|---|---|---|
| `/v1/predict` | POST | 4-head probability + CI; forbidden fields → 422; `<18` → 422; OOD badge |
| `/v1/explain` | POST | TreeSHAP values + `base_value` |
| `/v1/counterfactual` | POST | guardrailed Δpp for slider combos |
| `/v1/metrics` | GET | committed metrics table |
| `/v1/health` | GET | liveness + hashes |
| `/v1/model-info` | GET | model hash, thresholds, Brier |

Legacy unversioned routes redirect (301) to `/v1`.

## Leakage firewall

`Cath`, `LAD`, `LCX`, `RCA` are **never** inputs for any head. Enforced at three layers —
training (`guard.assert_no_forbidden`), the API schema (`extra="forbid"`), and CI
(`tests/test_leakage.py`).

## Tests

```bash
python -m pytest tests -q            # leakage, vessel-map, fastpre, api
cd web && npx playwright test        # e2e click-sync + counterfactual + watermark
```

## License

- Code: **MIT**
- Anatomical mesh: BodyParts3D (Database Center for Life Science) — **CC BY-SA 2.1 JP**
- Dataset: UCI *Extension of Z-Alizadeh Sani* — cite the UCI repository (CC BY 4.0)

See `ASSETS_LICENSE.md` and `BIAS.md`.