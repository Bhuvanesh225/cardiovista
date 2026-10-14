# CardioVista — Documentation

**Track A · Multimodal AI Hackathon 2026 · Cardiovascular Risk Visualization & Prediction**
*Educational screening aid — not a diagnostic device.*

This is the 6-page deliverable. Each section below is one page.

---

## Page 1 — Overview & architecture

**One sentence:** CardioVista turns routine demographics, symptoms, vitals, ECG, labs and echo
into **calibrated four-head risk** (CAD + LAD/LCX/RCA stenosis ≥ 50%), mapped live onto one
anatomical 3D heart and explained with TreeSHAP — CPU-only, leakage-guarded, Brier-honest.

```
┌──────────────── FRONTEND (Vite 5 · React 18 · TS 5) ─────────────────┐
│  Dashboard (3-col lg → stacked mobile)                              │
│   Left  : 55-field form + 3 frozen presets + CSV upload             │
│   Center: <HeartScene/> R3F · emissive/pulse · isolate · X-ray       │
│   Right : CAD hero (p + CI + Youden) · 3 vessel bars · SHAP · Δpp    │
│  zustand store · api.ts typed client · vesselConfig.ts sole map      │
└──────────────▲─────────────────────────────────────▲────────────────┘
               │ POST /v1/predict /v1/explain /v1/counterfactual
┌──────────────┴──────────── BACKEND (FastAPI · pydantic v2) ─────────┐
│  routers/v1.py → RiskModel adapter → 4× CalibratedHead(XGBoost)      │
│  guard.py  leakage firewall + range chips + <18 + audit              │
│  ood.py    IsolationForest(0.05) → amber OOD-review badge            │
│  registry.json {model_hash, mesh_sha, thresholds, brier}             │
└─────────────────────────────────────────────────────────────────────┘
```

**Stack.** Vite 5 · React 18 · TypeScript 5 · Tailwind · `@react-three/fiber` · drei ·
zustand · FastAPI · pydantic v2 · joblib · xgboost · scikit-learn · shap · optuna.

**Frozen version table.** seed 42 · model hash + mesh SHA pinned in `app/registry.json` and
checked at API startup (fail on drift).

---

## Page 2 — Data & the leakage firewall

**Source.** UCI *Extension of Z-Alizadeh Sani* — 303 patients, 55 routine features, 4
angiography targets (`Cath`, `LAD`, `LCX`, `RCA`). Prevalence: CAD 71.3%, LAD 58.4%,
LCX 39.3%, RCA 37.6%.

**Allowed inputs (5 domains):** demographics · vitals/exam · symptoms · ECG · labs · echo
(`Region RWMA` is a categorical finding, never XYZ coordinates).

**FORBIDDEN (hard rule).** `Cath`, `LAD`, `LCX`, `RCA` never enter *any* head:

| Predicting | Drops |
|---|---|
| CAD | `LAD, LCX, RCA, Cath` |
| LAD | `Cath, LCX, RCA` |
| LCX | `Cath, LAD, RCA` |
| RCA | `Cath, LAD, LCX` |

**Guard layers.**
1. `train/guard.py::assert_no_forbidden` — per-target DROP + substring check *before any fit*.
2. API `extra="forbid"` — unknown/forbidden fields → **422**.
3. CI `tests/test_leakage.py` — asserts DROP + forbid_extra + range + `<18` + OOD.

**Range chips:** Age 18–100 · SBP 80–250 · DBP 40–150 · LDL 40–400 · HDL 15–150 · FBS 60–500 ·
EF 10–80 and dataset bounds for the rest. **`<18` → hard 422** with a plain-language message.
**OOD:** `IsolationForest(contamination=0.05)` → amber badge; prediction still shown, PDF export
blocked.

---

## Page 3 — Models & calibration

Four **independent** XGBoost binaries (separate prevalence, drivers, thresholds). Preprocessing
(`median impute + standardise` for numeric, `one-hot` for categorical) lives **inside** the
pipeline and is never fitted on the full dataset. Imbalance uses `scale_pos_weight`; SMOTE is an
inside-fold ablation only.

**Tuning.** Optuna, seed 42, objective PR-AUC. **Validation.** Repeated stratified 5-fold × 5
seeds = 25 fits/head, with **nested calibration** and 2000× bootstrap AUC CIs.

**Calibration rule (frozen).** Sigmoid by default; isotonic kept only if it wins Brier by
> 0.003.

**Measured (seed 42, out-of-fold):**

| Head | Cal | ROC-AUC [95% CI] | PR-AUC | Brier | ECE | Youden | Sens@J | CV mean±SD |
|---|---|---|---|---|---|---|---|---|
| CAD | isotonic | 0.91 [0.87–0.95] | 0.960 | 0.098 | 0.032 | 0.69 | 88% | 0.904 ± 0.007 |
| LAD | isotonic | 0.84 [0.80–0.89] | 0.879 | 0.153 | 0.062 | 0.59 | 82% | 0.835 ± 0.013 |
| LCX | isotonic | 0.76 [0.71–0.82] | 0.635 | 0.195 | 0.077 | 0.42 | 71% | 0.741 ± 0.004 |
| RCA | isotonic | 0.74 [0.68–0.79] | 0.607 | 0.198 | 0.028 | 0.38 | 70% | 0.727 ± 0.012 |

*Exact values are read live from `artifacts/metrics.json` in the app.* Reliability, ROC, PR and
confusion figures are committed under `artifacts/`.

---

## Page 4 — The 3D heart

**Single frozen asset** `assets/heart_bp3d.glb` — **33,578 triangles / 0.71 MB**, glTF binary,
with named nodes `myocardium`, `aorta`, `pulmonary_trunk`, `coronary_LAD`, `coronary_LCX`,
`coronary_RCA`. SHA-256 `47965791…653b`, pinned in the registry.

**License.** BodyParts3D (Database Center for Life Science) — **CC BY-SA 2.1 JP only**; the NIH
mirror was dropped for a clean licence chain. Attribution shown in-app and in `ASSETS_LICENSE.md`.

**`vesselConfig.ts` is the SOLE probability → mesh correspondence.** `tests/test_vessel_map.py`
parses the GLB and asserts all three coronary nodes exist and match the config (CI fails on drift).

**Visual grammar.** green `< 30%` · amber `30–60%` · red `> 60%` (legend + numeric % →
colour-blind safe). `emissiveIntensity = 0.35 + 0.65·p`; the highest vessel pulses via
`useFrame`. Myocardium is warm off-white with an X-ray (transparent) toggle; selected vessels get
a dashed edge overlay; raycast-enlarged hit targets for touch.

**Controls.** Orbit + autoRotate + click-select + `Html` labels + isolate + X-ray + Anterior /
Lateral / Inferior presets. **Perf:** `dpr [1, 1.5]`, adaptive; click↔bar sync is e2e-tested.

**Fallback.** `Fallback2D` renders the same green/amber/red mapping and % when WebGL is absent;
mobile 360 px verified. `prefers-reduced-motion` pauses the pulse and auto-rotate.

---

## Page 5 — Dashboard, SHAP & the live counterfactual

**Layout.** three columns on `lg` (form | 3D + legend | risk + SHAP) → stacked on mobile.

- **Left:** the 55-field form with physiological chips, three **frozen** presets (Typical-angina
  58M · Low-risk 44F · Borderline 61M) shared by docs, video and e2e, plus CSV upload.
- **Center:** `<HeartScene/>` + legend + isolate chips + X-ray + orientation presets.
- **Right:** CAD hero (probability + 95% CI + Youden threshold + HIGH/MOD/LOW) and three vessel
  bars with CI whiskers and a threshold tick.

**SHAP.** Real `TreeExplainer` with a **50-medoid background**; per-vessel waterfall (top-8), the
**base value** always shown, plus 5-domain plain-language grouping (Demographics / Vitals /
Symptoms / ECG / Labs / Echo). Sign colour: red = risk-increasing, blue = protective.

**Live counterfactual (not illustrative).** Sliders for SBP / LDL / HDL / quit-smoking issue a
debounced `POST /v1/counterfactual`; Δpp is shown with a guardrail note. OOD combinations block
export. Example: SBP 150→120 + quit smoking lowers CAD risk by a double-digit percentage-point
margin on the frozen 58M exemplar.

---

## Page 6 — Safety, latency, reproducibility & risks

**Safety.** Amber banner site-wide + first-predict modal (must acknowledge) + watermark on every
exported PDF. Wording: *"Educational screening aid only — not diagnosis. No PHI stored. Discuss
amber or red results with a clinician."* No names/IDs accepted; CSV rows are held in memory;
exports contain only probabilities, explanations and the disclaimer. AHA patient guidance linked
in the modal; no dark patterns.

**Latency (CPU only, no GPU).** `/v1/predict` p50 ≪ 200 ms budget; `/v1/explain` (bg 50) well
under 600 ms; counterfactual round-trip < 300 ms after a 300 ms debounce. The serve path uses a
numpy **FastPre** fast path that reproduces the fitted ColumnTransformer exactly
(`tests/test_fastpre.py`). 3D targets 60 fps on integrated graphics at DPR 1–1.5. Numbers are
regenerated by `train/bench_latency.py` into `artifacts/bench_latency.json`; CI fails on
regression.

**Reproducibility.** `python train/train.py --seed 42` (< 15 min CPU) → `uvicorn app.main:app` →
`cd web && npm run dev`. Model + mesh hashes are pinned; startup fails on drift.

**Risk register.**

| Risk | Mitigation |
|---|---|
| n=303 single-centre overfit | repeated 5×5 + bootstrap CIs + Youden honesty + `BIAS.md` |
| SMOTE leakage | inside-fold only; default `scale_pos_weight`; CI asserts placement |
| Mesh licence/size | single CC BY-SA 2.1 JP + attribution + SHA + `< 3 MB` proof |
| Calibration harm | Brier-gated sigmoid-default rule with reliability evidence |
| Perf regression | FastPre + DPR cap + 2D fallback + CI bench gate |

**Deliverables covered:** working web prototype · trained pipeline + weights (seed 42) ·
explanation dashboard · these 6 pages · video script · public repo + README · full source.