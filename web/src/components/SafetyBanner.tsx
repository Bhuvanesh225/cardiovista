export function SafetyBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-[12.5px] text-amber-200 sm:px-6"
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2 1 21h22L12 2zm0 6 6.5 11.5h-13L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z"
        />
      </svg>
      <p className="leading-snug">
        <strong className="font-bold">Educational screening aid only — not diagnosis.</strong> No PHI
        stored. Discuss amber or red results with a clinician.{" "}
        <button
          type="button"
          onClick={onOpen}
          className="font-semibold text-amber-100 underline underline-offset-2 hover:text-white"
        >
          Read the limits
        </button>
      </p>
    </div>
  );
}