# CardioVista — submission checklist

## Official Track A deliverables

- [x] **Working web prototype** — interactive 3D viewer + ML backend (`web/` + `app/`).
- [x] **Trained prediction pipeline + weights** — `train/train.py` (seed 42) → `app/models/models.joblib`.
- [x] **Clinical explanation dashboard** — metrics screen + TreeSHAP waterfall + 5-domain grouping + live counterfactual.
- [x] **Project documentation, max 6 pages** — `docs/documentation.md`.
- [ ] **Demo video 3–10 min** — script in `docs/video-script.md` (record + upload).
- [x] **Public GitHub repo with README** — `README.md`.
- [x] **Full source + documentation committed.**

## Ship gate (all must be green)

- [x] Latency: predict p95 < 200 ms · explain p95 < 600 ms (`artifacts/bench_latency.json`).
- [x] Leakage: `tests/test_leakage.py` green.
- [x] Vessel map: `tests/test_vessel_map.py` green (3 coronary nodes in the GLB).
- [x] FastPre parity: `tests/test_fastpre.py` green.
- [x] API: `tests/test_api.py` green (422 on forbidden + `<18`).
- [x] Registry hashes present (model + mesh), startup drift check.
- [ ] Lighthouse > 90 (run against `npm run preview`).
- [ ] Playwright e2e green (`cd web && npx playwright test`).
- [x] Type-check + production build green (`npx tsc -b && npx vite build`).

## Files of record

| Artefact | Path |
|---|---|
| Frozen metrics | `artifacts/metrics.json` |
| Uncertainty table | `artifacts/calibration_uncertainty.csv` |
| Latency proof | `artifacts/bench_latency.json` |
| Figures | `artifacts/{roc,pr,reliability}_*.png` |
| Model registry | `app/registry.json` |
| Mesh hash | `assets/sha256.txt` |
| Frozen presets | `app/presets.json` |
| Bias card | `BIAS.md` |
| Licences | `ASSETS_LICENSE.md`, `LICENSE` |