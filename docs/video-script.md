# CardioVista — Demo video script (5:00)

Target length 3–10 min; this cut is 5:00. Unlisted or public on YouTube, English audio/subs.

| Time | Shot | Voiceover |
|---|---|---|
| 0:00–0:30 | Title card → dashboard, safety banner and modal visible. | "Heart disease is the leading cause of death, yet the routine data that predicts it — demographics, symptoms, vitals, ECG, labs, echo — usually sits unused. CardioVista is an **educational screening aid**: it turns that routine data into calibrated risk and shows you exactly why. This is not a diagnostic device." |
| 0:30–1:30 | Load the **Typical-angina 58M** preset → click **Run prediction** → CAD hero shows HIGH, the LAD coronary turns red and pulses. | "Here is a 58-year-old man with typical angina. One click. CardioVista gives a calibrated probability of coronary artery disease — with its 95% confidence interval, the Youden operating point, and a per-vessel estimate for LAD, LCX and RCA. The red, pulsing coronary is the highest-risk vessel." |
| 1:30–2:30 | Orbit the heart; open the SHAP waterfall; switch tabs CAD→LAD→LCX→RCA. | "Rotate, zoom, isolate a vessel, switch to X-ray. On the right, a real TreeSHAP waterfall shows the drivers — age, ST depression, the RWMA region — and the protective factors, like a favourable HDL. The same explanation is grouped into plain-language clinical domains." |
| 2:30–3:30 | Drag the **counterfactual** sliders (SBP 150→120, quit smoking) → Δpp updates live. | "This is not an illustration. Drag systolic blood pressure down and stop smoking, and the model recomputes in real time — a double-digit percentage-point drop in risk, with a guardrail note. Values are clamped to validated ranges, and out-of-distribution combinations block the export." |
| 3:30–4:15 | Metrics screen → calibration table + ROC/reliability figures → registry hashes. | "Everything is honest and reproducible: repeated 5-fold cross-validation with bootstrap confidence intervals, Brier scores, calibration error, and the reliability curves. The model and mesh hashes are pinned — if either drifts, the server refuses to start." |
| 4:15–5:00 | Bias card, licence, then back to the live dashboard. | "It runs on a laptop CPU, renders at sixty frames per second on integrated graphics, and has a 2D fallback. And it is transparent about its limits: 303 patients, one centre, male-heavy, no external validation — all in the bias card. An educational aid, built to be honest. CardioVista." |

**On-screen lower-thirds:** dataset (UCI Z-Alizadeh Sani, n=303) · seed 42 · model hash · mesh
CC BY-SA 2.1 JP attribution.

**Claims to freeze on screen (all replayable):** CAD AUC 0.91 [0.87–0.95], Brier 0.098, ECE 0.032 ·
25 fits/head · predict p95 < 200 ms · explain p95 < 600 ms · mesh 33,578 tris / 0.71 MB.