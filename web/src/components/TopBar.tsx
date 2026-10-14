export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M12 21s-7.5-4.6-9.6-9.1C1 8.5 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2.1.6-1.1 1.9-2.1 3.8-2.1 3.2 0 5.2 3 3.8 6.4C19.5 16.4 12 21 12 21z"
              fill="#04122b"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-white">CardioVista</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            CAD risk · 3D map
          </div>
        </div>
        <span className="ml-1 hidden rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning sm:inline">
          Screening aid
        </span>
      </div>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
        {(
          [
            ["dashboard", "Dashboard"],
            ["metrics", "Metrics"],
            ["docs", "Docs"],
          ] as const
        ).map(([id, label]) => (
          <NavLink key={id} id={id} label={label} />
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ModelHashPill />
      </div>
    </header>
  );
}

import { useRiskStore } from "../lib/store";

function NavLink({ id, label }: { id: "dashboard" | "metrics" | "docs"; label: string }) {
  const screen = useRiskStore((s) => s.screen);
  const setScreen = useRiskStore((s) => s.setScreen);
  const active = screen === id;
  return (
    <button
      type="button"
      onClick={() => setScreen(id)}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
        active ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-raised hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function ModelHashPill() {
  const hash = useRiskStore((s) => s.modelHash);
  const openSafety = useRiskStore((s) => s.openSafety);
  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-container px-3 py-1.5 text-[11px] font-semibold text-muted sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        v1.0 · hash {hash ? hash.slice(0, 6) : "····"}
      </span>
      <button
        type="button"
        onClick={openSafety}
        aria-label="Safety and privacy information"
        title="Safety & privacy"
        className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface-container text-muted transition hover:text-white"
      >
        ?
      </button>
    </div>
  );
}