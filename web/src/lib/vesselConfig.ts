// vesselConfig — the SOLE probability -> mesh-node correspondence.
// A CI test (web/src/lib/vesselConfig.test.md + tests/test_vessel_map.py)
// asserts every `meshName` exists in the committed heart.glb.
//
// Mesh: Innerscene "Heart" (CC0, adapted from MakeHuman/MPFB CC0 assets) —
// a smooth, textured teaching heart (~10.8k tris) with separately named
// epicardial vessels. Mapping notes (honest limitation, also shown in UI):
//   The mesh ships no isolated LCX or RCA trunk (only small diagonal /
//   marginal branches), so the LAD/LCX/RCA risk highlights are slender
//   procedural tubes raycast onto the true grooves at runtime (see
//   HeartScene.coronaryTrunks); the native coronary meshes stay hidden so no
//   small branch masquerades as a main trunk. Per-vessel probabilities estimate
//   P(stenosis >= 50%) for that territory — they do NOT localise a lesion.
//   `meshName` below names each head's nearest native branch: it is asserted
//   against the GLB in tests/test_vessel_map.py and drives the explode
//   direction of that head's trunk.
//   Runtime Html badges anchor to the computed trunk center
//   (course.center); `labelPos` below is a documented fallback anchor near the
//   corresponding groove so neighbouring markers never share an origin.

import type { HeadName } from "./types";

export interface VesselConfig {
  head: Exclude<HeadName, "cad">;
  meshName: string;
  label: string;
  full: string;
  /** camera preset (deg) that best shows this vessel */
  cameraPreset: { theta: number; phi: number };
  /** Html label anchor in model space (metres) */
  labelPos: [number, number, number];
  /** constant screen-space nudge (px) so neighbouring markers never touch */
  screenOffset: [number, number];
}

export const VESSEL_CONFIG: VesselConfig[] = [
  {
    head: "lad",
    meshName: "Anterior interventricular artery",
    label: "LAD",
    full: "Left anterior descending",
    cameraPreset: { theta: 0, phi: 1.35 },
    labelPos: [-0.01, 0.05, 0.06],
    screenOffset: [-26, -6],
  },
  {
    head: "lcx",
    meshName: "Diagonal coronary branch",
    label: "LCX",
    full: "Left circumflex",
    cameraPreset: { theta: -1.15, phi: 1.45 },
    labelPos: [-0.05, 0.08, 0.02],
    screenOffset: [20, 10],
  },
  {
    head: "rca",
    meshName: "Right marginal coronary artery",
    label: "RCA",
    full: "Right coronary artery",
    cameraPreset: { theta: 1.25, phi: 1.5 },
    labelPos: [0.05, 0.07, 0.02],
    screenOffset: [0, 0],
  },
];

export const VESSEL_BY_MESH: Record<string, VesselConfig> = Object.fromEntries(
  VESSEL_CONFIG.map((v) => [v.meshName, v]),
);

export const VESSEL_BY_HEAD: Record<string, VesselConfig> = Object.fromEntries(
  VESSEL_CONFIG.map((v) => [v.head, v]),
);

// Non-vessel anatomy that is always present (verified against the GLB nodes).
export const ANATOMY_NODES = [
  "Heart ventricular and atrial myocardium",
  "Ascending aorta and aortic arch",
  "Pulmonary trunk",
];

// Probability -> emissive/lerp colour (mirrors the green/amber/red banding).
export const probToColor = (p: number): string =>
  p > 0.6 ? "#FB2C36" : p >= 0.3 ? "#FF6900" : "#00C950";

export type { HeadName };