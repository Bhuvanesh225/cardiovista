import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MetricsResponse } from "../lib/types";

const HEADS = ["cad", "lad", "lcx", "rca"] as const;

export function MetricsScreen() {
  const [m, setM] = useState<MetricsResponse | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.metrics().then(setM).catch(() => setErr(true));
  }, []);

  if (err) {
    return <Notice>Metrics artefact not found. Run <code>python train/train.py</code> first.</Notice>;
  }
  if (!m) return <Notice>Loading metrics…</Notice>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Model metrics &amp; validation</h1>
        <p className="mt-1 text-[13px] text-muted">
          Repeated stratified 5-fold × {m.repeats} out-of-fold ({m.repeats * 5} fits/head), nested
          calibration, {m.n_rows} patients · seed {m.seed} · features {m.n_features}. Every number is
          reproducible from <code>artifacts/metrics.json</code>.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-panel">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Head</th>
              <th className="px-4 py-3">Calibration</th>
              <th className="px-4 py-3">ROC-AUC [95% CI]</th>
              <th className="px-4 py-3">PR-AUC</th>
              <th className="px-4 py-3">Brier</th>
              <th className="px-4 py-3">ECE</th>
              <th className="px-4 py-3">Youden-J</th>
              <th className="px-4 py-3">Sens@J</th>
              <th className="px-4 py-3">CV mean ± SD</th>
            </tr>
          </thead>
          <tbody>
            {HEADS.map((h) => {
              const hm = m.heads[h];
              return (
                <tr key={h} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-bold text-white">
                    {h === "cad" ? "CAD" : h.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{hm.calibration}</td>
                  <td className="tabular px-4 py-3 text-slate-200">
                    {hm.roc_auc.toFixed(3)}{" "}
                    <span className="text-muted">
                      [{hm.roc_ci[0].toFixed(2)}–{hm.roc_ci[1].toFixed(2)}]
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-slate-200">{hm.pr_auc.toFixed(3)}</td>
                  <td className="tabular px-4 py-3 text-slate-200">{hm.brier.toFixed(3)}</td>
                  <td className="tabular px-4 py-3 text-slate-200">{hm.ece.toFixed(3)}</td>
                  <td className="tabular px-4 py-3 text-slate-200">{hm.youden.toFixed(2)}</td>
                  <td className="tabular px-4 py-3 text-slate-200">
                    {(hm.sensitivity_at_youden * 100).toFixed(0)}%
                  </td>
                  <td className="tabular px-4 py-3 text-slate-300">
                    {hm.cv_auc_mean.toFixed(3)} ± {hm.cv_auc_sd.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Calibration & leakage guard">
          <p>
            Preprocessing (median impute + standardise + one-hot) is fitted <em>inside</em> every fold.
            Sigmoid is the default when the positive class is small; isotonic is kept only when it wins
            Brier by &gt; 0.003. Calibration is nested — never fitted on test data.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            {HEADS.map((h) => {
              const hm = m.heads[h];
              const sig = hm.brier_sigmoid?.toFixed(4) ?? "—";
              const iso = hm.brier_isotonic?.toFixed(4) ?? "—";
              return (
                <div key={h} className="rounded-lg bg-surface-container p-2.5">
                  <dt className="text-[10px] uppercase tracking-wider text-muted">{h} Brier sig→iso</dt>
                  <dd className="tabular mt-0.5 font-bold text-white">
                    {sig} → {iso} · {hm.calibration}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-[11.5px] text-muted">
            Per-patient 95% CI = 1.96·√(p(1−p)/n) + head ECE, +0.03 in the 0.35–0.65 borderline band.
            LCX/RCA carry wider intervals (higher Brier/ECE) — shown on every vessel bar.
          </p>
        </Card>

        <Card title="Bias & limitations">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>n = {m.n_rows}, single-centre (Tehran), male-heavy — no external cohort.</li>
            <li>Symptom-enriched cohort; may overestimate risk in truly low-risk patients.</li>
            <li>No imaging, no calcium score; Region RWMA is a flag, not a lesion map.</li>
            <li>Angiography results never enter the model — enforced by <code>test_leakage.py</code>.</li>
            <li>Confidence intervals and ECE are always shown; no accuracy theatre.</li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {HEADS.map((h) => (
          <figure key={h} className="rounded-xl border border-line bg-surface p-3 text-center">
            <img
              src={`/artifacts/roc_${h}.png`}
              alt={`${h.toUpperCase()} ROC curve`}
              className="mx-auto w-full rounded-lg bg-white"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
            <figcaption className="mt-2 text-[11px] font-semibold text-muted">
              {h.toUpperCase()} ROC · AUC {m.heads[h].roc_auc.toFixed(3)}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {HEADS.map((h) => (
          <figure key={`pr-${h}`} className="rounded-xl border border-line bg-surface p-3 text-center">
            <img
              src={`/artifacts/pr_${h}.png`}
              alt={`${h.toUpperCase()} precision-recall curve`}
              className="mx-auto w-full rounded-lg bg-white"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
            <figcaption className="mt-2 text-[11px] font-semibold text-muted">
              {h.toUpperCase()} PR · AP {m.heads[h].pr_auc.toFixed(3)}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {HEADS.map((h) => (
          <figure key={`rel-${h}`} className="rounded-xl border border-line bg-surface p-3 text-center">
            <img
              src={`/artifacts/reliability_${h}.png`}
              alt={`${h.toUpperCase()} reliability curve`}
              className="mx-auto w-full rounded-lg bg-white"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
            <figcaption className="mt-2 text-[11px] font-semibold text-muted">
              {h.toUpperCase()} reliability · Brier {m.heads[h].brier.toFixed(3)} · ECE{" "}
              {m.heads[h].ece.toFixed(3)}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-panel">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Head</th>
              <th className="px-4 py-3">n / n-pos</th>
              <th className="px-4 py-3">Confusion @Youden (TN FP / FN TP)</th>
              <th className="px-4 py-3">Confusion @0.5</th>
              <th className="px-4 py-3">Youden thr · Sens</th>
            </tr>
          </thead>
          <tbody>
            {HEADS.map((h) => {
              const hm = m.heads[h];
              const cy = hm.confusion_youden;
              const c5 = hm["confusion_0.5"];
              return (
                <tr key={h} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-bold text-white">
                    {h === "cad" ? "CAD" : h.toUpperCase()}
                  </td>
                  <td className="tabular px-4 py-3 text-slate-300">
                    {hm.n_test ?? m.n_rows} / {hm.n_pos_test ?? hm.n_pos}
                  </td>
                  <td className="tabular px-4 py-3 text-slate-200">
                    [{cy[0][0]} {cy[0][1]} / {cy[1][0]} {cy[1][1]}]
                  </td>
                  <td className="tabular px-4 py-3 text-slate-200">
                    [{c5[0][0]} {c5[0][1]} / {c5[1][0]} {c5[1][1]}]
                  </td>
                  <td className="tabular px-4 py-3 text-slate-300">
                    {hm.youden.toFixed(2)} · {(hm.sensitivity_at_youden * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Card title="Reproducibility">
        <div className="grid gap-2 text-[12px] sm:grid-cols-2">
          <Field label="Model hash" value={m.model_hash ?? "—"} />
          <Field label="Mesh SHA-256" value={m.mesh_sha ?? "—"} />
          <Field label="Generated" value={m.generated_at} />
          <Field label="Seed" value={String(m.seed)} />
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-panel">
      <h2 className="mb-2 text-[13px] font-bold text-white">{title}</h2>
      <div className="text-[12.5px] leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-0.5 truncate font-semibold text-slate-200" title={value}>
        {value}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center text-[13px] text-muted">{children}</div>
  );
}