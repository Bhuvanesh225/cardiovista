import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { ANATOMY_NODES, ORIENTATION_PRESETS, VESSEL_CONFIG, probToColor } from "../lib/vesselConfig";
import type { HeadName, Probs } from "../lib/types";
import { Fallback2D } from "./Fallback2D";

const GLB_URL = "/heart_bp3d.glb";
// Fill ~75% of the viewport height:
//   visible = 2 * CAMERA_DIST * tan(fov/2) ; MODEL_SIZE = 0.75 * visible
const CAMERA_DIST = 4.1;
const MODEL_SIZE = 2.25;

type VesselHead = Exclude<HeadName, "cad">;

interface SceneProps {
  probs: Probs | null;
  selected: HeadName;
  isolate: VesselHead | "all";
  xray: boolean;
  orientation: string;
  autoRotate: boolean;
  onSelectVessel: (head: HeadName) => void;
}

// ---------------------------------------------------------------------------
// Geometry helpers: the BodyParts3D mesh is ~90 units across and off-centre,
// so we normalise the whole assembly to ~2.6 units and re-centre on the origin.
// ---------------------------------------------------------------------------
function computeLayout(nodes: Record<string, THREE.Mesh>) {
  const box = new THREE.Box3();
  for (const name of [...ANATOMY_NODES, ...VESSEL_CONFIG.map((v) => v.meshName)]) {
    const mesh = nodes[name];
    if (!mesh?.geometry) continue;
    // BodyParts3D ships POSITION-only geometry — lighting needs normals.
    if (!mesh.geometry.hasAttribute("normal")) mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox as THREE.Box3);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = MODEL_SIZE / maxDim;
  // geometry is rotated +90° about X inside the group: (x, y, z) -> (x, -z, y)
  const rotatedCenter = new THREE.Vector3(center.x, -center.z, center.y);
  const position = rotatedCenter.clone().multiplyScalar(-scale);

  const labelDots: Record<string, THREE.Vector3> = {};
  for (const v of VESSEL_CONFIG) {
    const g = nodes[v.meshName]?.geometry;
    if (!g) continue;
    g.computeBoundingBox();
    const bb = g.boundingBox as THREE.Box3;
    // anchor each marker at a distinct anatomical end so neighbours separate
    if (v.head === "lad") labelDots[v.head] = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2);
    else if (v.head === "lcx") labelDots[v.head] = new THREE.Vector3(bb.max.x, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
    else labelDots[v.head] = bb.getCenter(new THREE.Vector3());
  }
  return { scale, position, labelDots };
}

function Model({ probs, selected, isolate, xray, autoRotate, orientation, onSelectVessel }: SceneProps) {
  const { nodes } = useGLTF(GLB_URL) as unknown as { nodes: Record<string, THREE.Mesh> };
  const reduced = usePrefersReducedMotion();
  const layout = useMemo(() => computeLayout(nodes), [nodes]);

  const anatomyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#F4EEE3"),
        roughness: 0.55,
        metalness: 0.0,
        emissive: new THREE.Color("#2a2118"),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: xray ? 0.12 : 1,
        depthWrite: !xray,
      }),
    [xray],
  );
  useEffect(() => () => anatomyMat.dispose(), [anatomyMat]);
  useEffect(() => {
    anatomyMat.opacity = xray ? 0.12 : 1;
    anatomyMat.depthWrite = !xray;
    anatomyMat.needsUpdate = true;
  }, [xray, anatomyMat]);

  return (
    <group scale={layout.scale} position={layout.position} rotation={[Math.PI / 2, 0, 0]} dispose={null}>
      {ANATOMY_NODES.map((name) =>
        nodes[name]?.geometry ? (
          <mesh key={name} geometry={nodes[name].geometry} material={anatomyMat} />
        ) : null,
      )}

      {VESSEL_CONFIG.map((v) => {
        const p = probs ? probs[v.head].p : 0.0;
        return (
          <VesselMesh
            key={v.head}
            geometry={nodes[v.meshName]?.geometry}
            head={v.head}
            p={p}
            color={probToColor(p)}
            dimmed={isolate !== "all" && isolate !== v.head}
            isSelected={selected === v.head}
            reduced={reduced}
            onSelect={onSelectVessel}
          />
        );
      })}

      {VESSEL_CONFIG.map((v, i) => {
        if (isolate !== "all" && isolate !== v.head) return null;
        const dot = layout.labelDots[v.head];
        if (!dot) return null;
        const p = probs ? probs[v.head].p : null;
        const c = probToColor(p ?? 0);
        return (
          <Html
            key={`label-${v.head}`}
            position={dot}
            center
            zIndexRange={[20, 0]}
            pointerEvents="auto"
          >
            <button
              type="button"
              onClick={() => onSelectVessel(v.head)}
              title={`${v.full}${p !== null ? ` — ${(p * 100).toFixed(0)}%` : ""}`}
              aria-label={`Select ${v.full}`}
              style={{
                borderColor: selected === v.head ? "#3D7DFF" : c,
                transform: `translate(${v.screenOffset[0]}px, ${v.screenOffset[1]}px)`,
              }}
              className={`grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-extrabold shadow-lg backdrop-blur transition-transform hover:scale-125 ${
                selected === v.head ? "bg-primary/50 text-white" : "bg-black/70 text-white"
              }`}
            >
              {i + 1}
            </button>
          </Html>
        );
      })}

      <Controls autoRotate={autoRotate} reduced={reduced} orientation={orientation} />
    </group>
  );
}

interface VesselMeshProps {
  geometry?: THREE.BufferGeometry;
  head: VesselHead;
  p: number;
  color: string;
  dimmed: boolean;
  isSelected: boolean;
  reduced: boolean;
  onSelect: (head: HeadName) => void;
}

function VesselMesh({ geometry, head, p, color, dimmed, isSelected, reduced, onSelect }: VesselMeshProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(color), [color]);
  const [hover, setHover] = useState(false);
  const t = useRef(0);

  useFrame((_, dt) => {
    if (!mat.current) return;
    mat.current.color.lerp(target, Math.min(1, dt * 6));
    mat.current.emissive.lerp(target, Math.min(1, dt * 6));
    const base = 0.4 + 0.6 * p;
    t.current += dt;
    const pulse = p > 0.6 && !reduced ? 0.55 + 0.45 * Math.sin(t.current * 4.2) : 1;
    mat.current.emissiveIntensity = dimmed ? base * 0.12 : base * pulse;
    mat.current.opacity = dimmed ? 0.18 : 1;
  });

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(head);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
      scale={hover ? 1.015 : 1}
    >
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={0.4 + 0.6 * p}
        roughness={0.4}
        metalness={0.0}
        transparent
        opacity={1}
        depthWrite={!dimmed}
        side={THREE.DoubleSide}
      />
      {isSelected ? (
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color="#3D7DFF" transparent opacity={0.5} />
        </lineSegments>
      ) : null}
    </mesh>
  );
}

// A single OrbitControls instance. Orientation presets animate the camera for a
// moment, then hand control back to the user (no per-frame fight).
function Controls({ autoRotate, reduced, orientation }: { autoRotate: boolean; reduced: boolean; orientation?: string }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desired = useRef<THREE.Vector3 | null>(null);
  const animating = useRef(false);
  const presetName = orientation ?? "anterior";

  useEffect(() => {
    const preset = ORIENTATION_PRESETS[presetName] ?? ORIENTATION_PRESETS.anterior;
    desired.current = new THREE.Vector3(
      CAMERA_DIST * Math.sin(preset.phi) * Math.sin(preset.theta),
      CAMERA_DIST * Math.cos(preset.phi),
      CAMERA_DIST * Math.sin(preset.phi) * Math.cos(preset.theta),
    );
    animating.current = true;
  }, [presetName]);

  useFrame(() => {
    if (animating.current && desired.current && controls.current) {
      camera.position.lerp(desired.current, 0.12);
      controls.current.update();
      if (camera.position.distanceTo(desired.current) < 0.02) animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate && !reduced}
      autoRotateSpeed={1.1}
      minDistance={3}
      maxDistance={9}
      onStart={() => {
        animating.current = false;
      }}
      target={[0, 0, 0]}
    />
  );
}

export function HeartScene(props: SceneProps) {
  const [webglOk] = useState(() => detectWebGL());
  if (!webglOk) return <Fallback2D probs={props.probs} />;

  return (
    <div className="relative h-full w-full" data-testid="heart-scene">
      <Canvas
        dpr={[1, 1.5]}
        frameloop="always"
        camera={{ position: [0.2, 0.6, CAMERA_DIST], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor("#0B0F18", 1)}
      >
        <ambientLight intensity={1.0} />
        <hemisphereLight args={["#e8efff", "#4a3d30", 0.75]} />
        <directionalLight position={[4, 6, 5]} intensity={1.7} />
        <directionalLight position={[-5, -2, -4]} intensity={0.8} color="#6f9cff" />
        <directionalLight position={[0, -4, 3]} intensity={0.45} color="#ffd9b0" />
        <Suspense fallback={null}>
          <Model
            probs={props.probs}
            selected={props.selected}
            isolate={props.isolate}
            xray={props.xray}
            orientation={props.orientation}
            autoRotate={props.autoRotate}
            onSelectVessel={props.onSelectVessel}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

useGLTF.preload(GLB_URL);