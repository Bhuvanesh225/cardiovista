import { ANATOMY_NODES, VESSEL_CONFIG, probToColor } from "../lib/vesselConfig";
import type { Probs } from "../lib/types";

// 2D SVG fallback shown when WebGL is unavailable. Same green/amber/red mapping
// and the same probability -> label correspondence as the 3D scene.
export function Fallback2D({ probs }: { probs: Probs | null }) {
  const pct = (h: "lad" | "lcx" | "rca") => (probs ? Math.round(probs[h].p * 100) : null);
  return (
    <div
      className="grid h-full w-full place-items-center bg-[#0B0F18] p-4"
      data-testid="heart-fallback"
      role="img"
      aria-label="2D coronary map fallback"
    >
      <svg viewBox="0 0 420 360" className="h-full max-h-[420px] w-full max-w-[520px]">
        <defs>
          <radialGradient id="myo" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#EDE6DB" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#b9ad9a" stopOpacity="0.8" />
          </radialGradient>
        </defs>
        <ellipse cx="210" cy="180" rx="120" ry="140" fill="url(#myo)" opacity="0.9" />
        <ellipse cx="210" cy="180" rx="120" ry="140" fill="none" stroke="#8A94A6" strokeOpacity="0.35" strokeDasharray="4 6" />
        <text x="210" y="34" textAnchor="middle" className="fill-slate-500" fontSize="11">
          2D fallback · WebGL unavailable
        </text>

        {/* LAD */}
        <path
          d="M210 60 C205 120, 198 170, 190 250"
          fill="none"
          stroke={probToColor(probs?.lad.p ?? 0)}
          strokeWidth="11"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.35}
        />
        {/* LCX */}
        <path
          d="M214 78 C260 120, 285 160, 300 216"
          fill="none"
          stroke={probToColor(probs?.lcx.p ?? 0)}
          strokeWidth="10"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.35}
        />
        {/* RCA */}
        <path
          d="M206 78 C160 120, 138 165, 126 224"
          fill="none"
          stroke={probToColor(probs?.rca.p ?? 0)}
          strokeWidth="10"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.35}
        />
        {VESSEL_CONFIG.map((v) => {
          const pos: Record<string, [number, number]> = { lad: [150, 250], lcx: [312, 226], rca: [116, 234] };
          const [x, y] = pos[v.head];
          const p = pct(v.head);
          return (
            <g key={v.head}>
              <circle cx={x} cy={y} r="13" fill={probToColor(probs?.[v.head].p ?? 0)} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#04122b">
                {v.label}
              </text>
              <text x={x} y={y + 30} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e5e9f0">
                {p === null ? "—" : `${p}%`}
              </text>
            </g>
          );
        })}
        <text x="210" y="344" textAnchor="middle" className="fill-slate-500" fontSize="10">
          {ANATOMY_NODES.length} anatomical structures · {VESSEL_CONFIG.length} coronaries
        </text>
      </svg>
    </div>
  );
}