# BIAS & LIMITATIONS — CardioVista

This card is shown on the dashboard and reproduced here in full. CardioVista is an
**educational screening aid**, not a diagnostic device.

## Dataset
- **Source:** UCI *Extension of Z-Alizadeh Sani* — 303 patients, 55 routine features,
  4 angiography targets (`Cath`, `LAD`, `LCX`, `RCA`).
- **Single centre:** one hospital in Tehran, Iran. No external validation cohort exists yet.
- **Case mix:** male-heavy and symptom-enriched (patients referred for angiography). A model
  trained here will tend to **overestimate** risk in genuinely low-risk populations.
- **No imaging:** there is no CT-calcium score, no angiographic image, no stress-test
  perfusion map. `Region RWMA` is a categorical echo flag, **not** a lesion localisation.
- **Temporal:** data collected pre-2017; treatment patterns and prevalence may have drifted.

## Known failure modes
1. **Under-18:** out of scope. The API hard-blocks age `< 18` with a plain-language message.
2. **Pregnant patients:** out of scope; not represented in the cohort.
3. **Very elderly:** sparse representation; predictions carry wider uncertainty.
4. **Out-of-distribution inputs:** an `IsolationForest(contamination=0.05)` raises an amber
   `OOD-review` badge. We still show the prediction (honesty over hiding) but **block PDF
   export** until reviewed.
5. **Borderline zone:** predictions in 0.35–0.65 are inherently uncertain; the UI highlights
   this band and always shows confidence intervals.

## Honesty commitments
- Confidence intervals (2000× bootstrap), ECE and the Youden operating point are **always
  visible** — never hidden behind a single accuracy number.
- Calibration is chosen by a **pre-registered rule**: sigmoid by default; isotonic only when
  it beats sigmoid's Brier score by more than 0.003.
- The displayed threshold (Youden-J) is an operating point, **not** a diagnosis line.
- Every metric in the app is reproducible from `artifacts/metrics.json` (seed 42).

## What we do NOT claim
- We do not claim clinical validity, regulatory clearance, or improvement in outcomes.
- We do not claim the per-vessel probabilities localise a lesion — they estimate the
  probability that a vessel has ≥ 50% stenosis.
- We do not accept or store protected health information. Inputs are processed in memory;
  exports contain only probabilities, explanations and the disclaimer.

## Path to responsible use (post-hackathon)
External multi-centre validation · prospective silent trial · FHIR integration ·
calcium-score head · federated/wearable inputs · full regulatory review (e.g. CE/FDA).