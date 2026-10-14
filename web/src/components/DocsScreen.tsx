export function DocsScreen() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Documentation</h1>
        <p className="mt-1 text-[13px] text-muted">
          How CardioVista works, what it is — and what it is not.
        </p>
      </header>

      <Section title="1 · What it does">
        <p>
          CardioVista turns routine demographics, symptoms, vitals, ECG, labs and echo into{" "}
          <strong>calibrated four-head risk</strong> — coronary artery disease plus LAD / LCX / RCA
          stenosis ≥ 50% — mapped live onto one anatomical 3D heart and explained with TreeSHAP.
        </p>
      </Section>

      <Section title="2 · The leakage firewall">
        <p>
          The four angiography results (Cath, LAD, LCX, RCA) are <strong>never</strong> model inputs.
          When predicting any head, the other angiography columns are dropped, rejected at the API
          schema (<code>extra="forbid"</code>) and asserted by <code>test_leakage.py</code> on every run.
        </p>
      </Section>

      <Section title="3 · Models & calibration">
        <p>
          Four independent XGBoost binaries, tuned with Optuna on PR-AUC. Preprocessing lives inside the
          pipeline. Calibration is chosen by a frozen rule: sigmoid by default unless isotonic wins
          Brier by &gt; 0.003. Headline numbers are repeated 5-fold × 5-seed out-of-fold with 2000×
          bootstrap AUC CIs and ECE — see the Metrics screen.
        </p>
      </Section>

      <Section title="4 · The 3D heart">
        <p>
          A single frozen anatomical mesh (Innerscene "Heart", CC0, 10,805 triangles with
          textured PBR materials) with named coronary nodes. Colour encodes probability (green &lt; 30%, amber 30–60%, red &gt; 60%); emissive intensity
          encodes probability and the highest vessel pulses (paused under{" "}
          <code>prefers-reduced-motion</code>). A 2D SVG fallback renders the same mapping when WebGL is
          unavailable.
        </p>
      </Section>

      <Section title="5 · Safety & PHI">
        <p>
          A persistent banner, a first-run modal and a watermark on every exported PDF state the same
          message: <em>educational screening aid, not diagnosis</em>. No names or IDs are accepted; CSV
          rows are processed in memory; exports contain only probabilities, explanations and the
          disclaimer. Patients under 18 are hard-blocked with a plain-language message.
        </p>
      </Section>

      <Section title="6 · Reproduce it">
        <pre className="overflow-x-auto rounded-lg bg-surface-container p-3 text-[11.5px] leading-relaxed text-slate-300">
{`# backend + model (CPU only, seed 42)
pip install -r requirements.txt
python train/train.py --seed 42 --optuna 30 --repeats 5
uvicorn app.main:app --port 8000

# frontend
cd web && npm install && npm run dev   # :5173 proxies :8000`}
        </pre>
      </Section>

      <Section title="Licensing">
        <ul className="list-disc space-y-1 pl-5">
          <li>Code: MIT.</li>
          <li>
            Anatomical mesh: Innerscene "Heart" (MakeHuman CC0 assets),{" "}
            <strong>CC0 1.0 public domain</strong>.
          </li>
          <li>Dataset: UCI Extension of Z-Alizadeh Sani — cite the UCI repository.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h2 className="mb-2 text-[15px] font-bold text-white">{title}</h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-slate-300 [&_code]:rounded [&_code]:bg-surface-container [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-primary">
        {children}
      </div>
    </section>
  );
}