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
      style={{
        background:
          "radial-gradient(60% 55% at 50% 42%, rgba(164,31,52,0.25) 0%, rgba(11,15,24,0) 70%), #0B0F18",
      }}
    >
      <svg viewBox="0 0 420 360" className="h-full max-h-[440px] w-full max-w-[540px]">
        <defs>
          <radialGradient id="myo2d" cx="42%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#d34a5c" stopOpacity="0.98" />
            <stop offset="45%" stopColor="#a41f34" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#5e0d1c" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="vesselWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </linearGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* cardiac silhouette: apex down, base + aortic arch up */}
        <path
          d="M210 312
             C150 268 84 224 78 152
             C74 104 106 70 148 74
             C168 76 184 86 196 100
             L198 62 C198 50 206 42 216 44 L232 47 C242 49 248 58 246 68 L240 102
             C254 88 272 80 290 84
             C330 92 348 128 338 170
             C326 232 268 272 210 312 Z"
          fill="url(#myo2d)"
          stroke="#3d0a14"
          strokeWidth="2"
        />
        {/* moist highlight on the left ventricle */}
        <ellipse cx="168" cy="170" rx="34" ry="62" fill="#ffffff" opacity="0.10" transform="rotate(-18 168 170)" />
        <ellipse cx="252" cy="200" rx="52" ry="70" fill="#000000" opacity="0.18" />
        {/* aortic arch hint */}
        <path
          d="M196 100 C190 78 196 52 218 48 C242 44 254 60 248 84"
          fill="none"
          stroke="#d9a68f"
          strokeWidth="13"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M196 100 C190 78 196 52 218 48 C242 44 254 60 248 84"
          fill="none"
          stroke="#8a4a3a"
          strokeWidth="13"
          strokeLinecap="round"
          opacity="0.25"
          strokeDasharray="3 5"
        />

        <text x="210" y="30" textAnchor="middle" className="fill-slate-400" fontSize="11">
          2D fallback · WebGL unavailable
        </text>

        {/* LAD — down the anterior wall */}
        <path
          d="M208 108 C206 150, 200 200, 192 252"
          fill="none"
          stroke={probToColor(probs?.lad.p ?? 0)}
          strokeWidth="11"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.4}
          filter="url(#softGlow)"
        />
        {/* LCX — to the left atrium edge */}
        <path
          d="M214 120 C256 148, 288 176, 304 220"
          fill="none"
          stroke={probToColor(probs?.lcx.p ?? 0)}
          strokeWidth="10"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.4}
          filter="url(#softGlow)"
        />
        {/* RCA — to the right border */}
        <path
          d="M204 120 C164 152, 138 184, 128 230"
          fill="none"
          stroke={probToColor(probs?.rca.p ?? 0)}
          strokeWidth="10"
          strokeLinecap="round"
          opacity={probs ? 1 : 0.4}
          filter="url(#softGlow)"
        />
        {VESSEL_CONFIG.map((v) => {
          const pos: Record<string, [number, number]> = { lad: [152, 256], lcx: [316, 230], rca: [116, 240] };
          const [x, y] = pos[v.head];
          const p = pct(v.head);
          return (
            <g key={v.head}>
              <circle cx={x} cy={y} r="14" fill="#0b0f18" opacity="0.75" />
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
