import { useRiskStore } from "../lib/store";

export function SafetyModal() {
  const show = useRiskStore((s) => s.showSafety);
  const ack = useRiskStore((s) => s.ackSafety);
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-panel">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="M12 2 1 21h22L12 2zm-1 12h2V9h-2v5zm0 3h2v2h-2v-2z" />
            </svg>
          </div>
          <h2 id="safety-title" className="text-lg font-bold text-white">
            Before you use CardioVista
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-[13.5px] leading-relaxed text-slate-300">
          <p>
            CardioVista is an <strong className="text-white">educational screening aid</strong>, not a
            diagnostic device. It estimates the probability of coronary artery disease and per-vessel
            stenosis from routine data and shows how the model reached its answer.
          </p>
          <ul className="space-y-2">
            {[
              "No PHI is stored — inputs are processed in memory and never persisted.",
              "Validated on 303 single-centre patients (Tehran), male-heavy; no external cohort yet.",
              "It has no imaging or calcium-score input; Region RWMA is a flag, not a lesion map.",
              "Adults only (age 18+); pregnant and elderly patients are out of scope.",
              "Discuss any amber or red result with a clinician.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <a
            href="https://www.heart.org/en/health-topics/heart-attack"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            AHA patient guidance ↗
          </a>
          <button
            type="button"
            onClick={ack}
            data-testid="safety-ack"
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-fg transition hover:brightness-110"
          >
            I understand — continue
          </button>
        </div>
      </div>
    </div>
  );
}