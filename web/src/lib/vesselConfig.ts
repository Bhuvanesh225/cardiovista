// vesselConfig — the SOLE probability -> mesh-node correspondence.
// A CI test (web/src/lib/vesselConfig.test.md + tests/test_vessel_map.py)
// asserts every `meshName` exists in the committed heart_bp3d.glb.

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
    meshName: "coronary_LAD",
    label: "LAD",
    full: "Left anterior descending",
    cameraPreset: { theta: 0, phi: 1.35 },
    labelPos: [0, 0, 0],
    screenOffset: [-26, -6],
  },
  {
    head: "lcx",
    meshName: "coronary_LCX",
    label: "LCX",
    full: "Left circumflex",
    cameraPreset: { theta: -1.15, phi: 1.45 },
    labelPos: [0, 0, 0],
    screenOffset: [20, 10],
  },
  {
    head: "rca",
    meshName: "coronary_RCA",
    label: "RCA",
    full: "Right coronary artery",
    cameraPreset: { theta: 1.25, phi: 1.5 },
    labelPos: [0, 0, 0],
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
export const ANATOMY_NODES = ["myocardium", "aorta", "pulmonary_trunk"];

// Camera presets for orientation control.
export const ORIENTATION_PRESETS: Record<string, { theta: number; phi: number; label: string }> = {
  anterior: { theta: 0, phi: 1.35, label: "Anterior" },
  lateral: { theta: -1.15, phi: 1.45, label: "Lateral" },
  inferior: { theta: 0, phi: 2.3, label: "Inferior" },
};

// Probability -> emissive/lerp colour (mirrors the green/amber/red banding).
export const probToColor = (p: number): string =>
  p > 0.6 ? "#FB2C36" : p >= 0.3 ? "#FF6900" : "#00C950";

export type { HeadName };