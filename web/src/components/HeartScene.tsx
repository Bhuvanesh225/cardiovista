import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { VESSEL_BY_HEAD, VESSEL_BY_MESH, VESSEL_CONFIG, probToColor } from "../lib/vesselConfig";
import type { HeadName, Probs } from "../lib/types";
import { Fallback2D } from "./Fallback2D";

const GLB_URL = "/heart.glb";
// Fill ~75% of the viewport height:
//   visible = 2 * CAMERA_DIST * tan(fov/2) ; MODEL_SIZE = 0.75 * visible
const CAMERA_DIST = 4.1;
const MODEL_SIZE = 2.25;

type VesselHead = Exclude<HeadName, "cad">;

// three's GLTFLoader sanitises node names on load
// (PropertyBinding.sanitizeNodeName: whitespace -> underscore), so the scene
// graph holds `Anterior_interventricular_artery` while vesselConfig keeps the
// human-readable `Anterior interventricular artery`. Bridge both spellings.
const sanitizeNodeName = (s: string) => s.replace(/\s/g, "_");

function resolveNode(nodes: Record<string, THREE.Mesh>, name: string): THREE.Mesh | undefined {
  return nodes[name] ?? nodes[sanitizeNodeName(name)];
}

const HIDDEN_NATIVE = new Set(VESSEL_CONFIG.map((v) => sanitizeNodeName(v.meshName)));

interface SceneProps {
  probs: Probs | null;
  selected: HeadName;
  isolate: VesselHead | "all";
  /** resting pulse (bpm) — the 3D beat follows the patient's PR slider */
  bpm: number;
  /** 0..1 exploded-view separation */
  explode: number;
  /** vessel the camera is currently glued to (null = overview) */
  focus: VesselHead | null;
  onSelectVessel: (head: HeadName) => void;
  onFocusVessel: (head: VesselHead) => void;
  onBackgroundClick: () => void;
}

// ---------------------------------------------------------------------------
// Thin risk trunks in the true coronary grooves. The source mesh ships no
// isolated LCX or RCA trunk — only small diagonal / marginal branches — so
// the LAD/LCX/RCA highlights are built at runtime as slender tubes: waypoint
// courses in model space are raycast against the anatomy and the first-hit
// surface points (lifted ~2 mm along the face normal) become CatmullRom tube
// control points. LAD runs the anterior interventricular groove, LCX the left
// atrioventricular groove, RCA the right atrioventricular groove round toward
// posterior. Model -X is the anatomic left.
// ---------------------------------------------------------------------------
const TUBE_LIFT = 0.002;
const TUBE_RADIUS: Record<VesselHead, number> = { lad: 0.002, lcx: 0.0018, rca: 0.0018 };

interface TrunkCourse {
  geometry: THREE.BufferGeometry;
  /** fat invisible twin for forgiving hover/click on the slender trunk */
  hitGeometry: THREE.BufferGeometry;
  center: THREE.Vector3;
}

function hugSurface(targets: THREE.Object3D[], origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null {
  const rc = new THREE.Raycaster(origin, dir.clone().normalize(), 0, 2);
  const hits = rc.intersectObjects(targets, false);
  if (!hits.length) return null;
  const h = hits[0];
  const n = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 0, 1);
  return h.point.clone().addScaledVector(n, TUBE_LIFT);
}

function buildTrunk(
  targets: THREE.Object3D[],
  origins: THREE.Vector3[],
  dirs: THREE.Vector3[],
  radius: number,
): TrunkCourse | null {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < origins.length; i++) {
    const p = hugSurface(targets, origins[i], dirs[i]);
    if (p) pts.push(p);
    else if (pts.length) pts.push(pts[pts.length - 1].clone());
  }
  if (pts.length < 4) return null;
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
  return {
    geometry: new THREE.TubeGeometry(curve, 72, radius, 10, false),
    hitGeometry: new THREE.TubeGeometry(curve, 36, radius * 3.5, 6, false),
    center: curve.getPoint(0.5),
  };
}

function coronaryTrunks(nodes: Record<string, THREE.Mesh>): Record<VesselHead, TrunkCourse | null> {
  // Temp meshes share the source geometries (never rendered — pure math, so
  // group transforms don't matter; every node transform is identity).
  const targets = Object.values(nodes).filter((m) => m?.geometry).map((m) => new THREE.Mesh(m.geometry));
  const out = {} as Record<VesselHead, TrunkCourse | null>;

  // LAD — down the anterior wall, slightly left of midline, base to apex.
  {
    const origins: THREE.Vector3[] = [];
    const dirs: THREE.Vector3[] = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      origins.push(new THREE.Vector3(-0.009 - 0.004 * t, 0.098 - 0.092 * t, 0.3));
      dirs.push(new THREE.Vector3(0, 0, -1));
    }
    out.lad = buildTrunk(targets, origins, dirs, TUBE_RADIUS.lad);
  }

  // LCX / RCA — atrioventricular grooves sweeping left (-X) / right (+X)
  // from the anterior base round toward posterior.
  const groove = (side: -1 | 1, head: VesselHead, thetaMax: number, yTop: number, yBot: number, n: number) => {
    const origins: THREE.Vector3[] = [];
    const dirs: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const theta = 0.3 + (thetaMax - 0.3) * t;
      const radial = new THREE.Vector3(side * Math.sin(theta), 0, Math.cos(theta));
      const y = yTop + (yBot - yTop) * t;
      origins.push(new THREE.Vector3(-0.002 + radial.x * 0.3, y, 0.004 + radial.z * 0.3));
      dirs.push(radial.clone().negate());
    }
    out[head] = buildTrunk(targets, origins, dirs, TUBE_RADIUS[head]);
  };
  groove(-1, "lcx", 1.85, 0.094, 0.064, 12);
  groove(1, "rca", 2.05, 0.094, 0.05, 13);
  return out;
}

// The native diagonal / marginal / interventricular meshes are hidden: the
// thin trunks above are the only coronary highlights, so no small branch
// ever masquerades as a main trunk.

// ---------------------------------------------------------------------------
// Layout: the mesh ships in metres, Y-up, apex-down — already anatomical —
// so the assembly is only normalised to ~2.25 units and re-centred.
// ---------------------------------------------------------------------------
function computeLayout(nodes: Record<string, THREE.Mesh>) {
  const box = new THREE.Box3();
  // Measure the whole assembly (myocardium + great vessels + coronaries)
  // so tall structures (aortic arch, SVC) stay in frame.
  for (const mesh of Object.values(nodes)) {
    if (!mesh?.geometry) continue;
    if (!mesh.geometry.hasAttribute("normal")) mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox as THREE.Box3);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = MODEL_SIZE / maxDim;
  const position = center.clone().multiplyScalar(-scale);

  const labelDots: Record<string, THREE.Vector3> = {};
  // Vessel centres in model space. Vessels stay glued to the
  // myocardium surface — no outward push, so they never float off the wall.
  // Mid-course anchors keep the numbered badges on the vessel, clear of the
  // crowded base (aorta / pulmonary trunk) at the top of the model.
  const vesselCenters: Record<string, THREE.Vector3> = {};
  for (const v of VESSEL_CONFIG) {
    const g = resolveNode(nodes, v.meshName)?.geometry;
    if (!g) continue;
    g.computeBoundingBox();
    const bb = g.boundingBox as THREE.Box3;
    const c = bb.getCenter(new THREE.Vector3());
    labelDots[v.head] = c.clone();
    vesselCenters[v.head] = c.clone();
  }
  // Explode directions: radial, from the assembly centre through each part's
  // own centre, so the slider lifts great vessels and coronaries off the
  // myocardium instead of scattering them.
  const assemblyCenter = center.clone();
  const explodeDirs: Record<string, THREE.Vector3> = {};
  for (const [name, mesh] of Object.entries(nodes)) {
    const bb = mesh?.geometry?.boundingBox as THREE.Box3 | undefined;
    if (!bb) continue;
    const c = bb.getCenter(new THREE.Vector3());
    const dir = c.clone().sub(assemblyCenter);
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
    explodeDirs[name] = dir.normalize();
  }
  return { scale, position, labelDots, vesselCenters, explodeDirs };
}

// Max explode travel in model units (metres — the mesh ships at real scale).
// Kept small on purpose: the assembly should breathe apart, never leave frame.
// Surface coronaries travel less than the great vessels.
const EXPLODE_SPREAD = 0.032;
const VESSEL_EXPLODE_FACTOR = 0.55;

function Model({ probs, selected, isolate, bpm, explode, focus, onSelectVessel, onFocusVessel }: SceneProps) {
  const { nodes } = useGLTF(GLB_URL) as unknown as { nodes: Record<string, THREE.Mesh> };
  const reduced = usePrefersReducedMotion();
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  // Procedural risk trunks, hugging the true LAD/LCX/RCA grooves.
  const trunks = useMemo(() => coronaryTrunks(nodes), [nodes]);
  useEffect(() => () => Object.values(trunks).forEach((t) => (t?.geometry.dispose(), t?.hitGeometry.dispose())), [trunks]);
  const beatRef = useRef<THREE.Group>(null);
  const beatPhase = useRef(Math.random());
  const [hover, setHover] = useState<{ head: VesselHead; local: THREE.Vector3 } | null>(null);

  // Hover point arrives in world space; the tooltip lives inside the
  // scaled beat group, so convert once here.
  const handleHover = (head: VesselHead, world: THREE.Vector3 | null) => {
    const g = beatRef.current;
    if (!world || !g) {
      setHover(null);
      return;
    }
    setHover({ head, local: g.worldToLocal(world.clone()) });
  };

  const explodeVec = (name: string) => {
    const factor = VESSEL_BY_MESH[name] ? VESSEL_EXPLODE_FACTOR : 1;
    const dir =
      layout.explodeDirs[name] ??
      layout.explodeDirs[sanitizeNodeName(name)] ??
      new THREE.Vector3(0, 1, 0);
    return dir.clone().multiplyScalar(explode * EXPLODE_SPREAD * factor);
  };

  // Camera focus target in world space (beat pulse ±2% ignored).
  const focusTarget = useMemo(() => {
    if (!focus) return null;
    const c = trunks[focus]?.center ?? layout.vesselCenters[focus];
    if (!c) return null;
    return c.clone().multiplyScalar(layout.scale).add(layout.position);
  }, [focus, layout, trunks]);

  // Gentle lub-dub heartbeat about the centred origin, at the patient's
  // own resting pulse.
  useFrame(({ clock }) => {
    const g = beatRef.current;
    if (!g) return;
    if (reduced) {
      g.scale.setScalar(layout.scale);
      return;
    }
    const t = clock.elapsedTime;
    const beatsPerSec = Math.min(3.2, Math.max(0.5, bpm / 60));
    const ph = (t * beatsPerSec + beatPhase.current) % 1;
    const thump =
      Math.exp(-Math.pow((ph - 0.14) * 9, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.34) * 9, 2));
    g.scale.setScalar(layout.scale * (1 + 0.022 * thump));
  });

  return (
    <>
      <group ref={beatRef} scale={layout.scale} position={layout.position}>
        {/* Every non-coronary part keeps its authored textured material:
            myocardium, aortic arch + head-arm branches, pulmonary trunk and
            arteries, venae cavae and pulmonary veins. Each rides its own
            explode wrapper so the slider separates the assembly. */}
        {/* Great vessels + myocardium keep authored materials. The three
            native coronary meshes are hidden — the thin trunks below are the
            only coronary highlights. */}
        {Object.entries(nodes).map(([name, mesh]) => {
          if (!mesh?.geometry || HIDDEN_NATIVE.has(name)) return null;
          return (
            <group key={name} position={explodeVec(name)}>
              <mesh
                geometry={mesh.geometry}
                material={mesh.material as THREE.Material}
                castShadow
                receiveShadow
              />
            </group>
          );
        })}

        {VESSEL_CONFIG.map((v) => {
          const course = trunks[v.head];
          if (!course) return null;
          const p = probs ? probs[v.head].p : 0.0;
          return (
            <VesselMesh
              key={v.head}
              geometry={course.geometry}
              hitGeometry={course.hitGeometry}
              head={v.head}
              p={p}
              color={probToColor(p)}
              dimmed={isolate !== "all" && isolate !== v.head}
              isSelected={selected === v.head}
              reduced={reduced}
              onSelect={onSelectVessel}
              onFocus={onFocusVessel}
              onHover={handleHover}
              explodeOffset={explodeVec(v.meshName)}
            />
          );
        })}

        {VESSEL_CONFIG.map((v, i) => {
          if (isolate !== "all" && isolate !== v.head) return null;
          const course = trunks[v.head];
          if (!course) return null;
          const p = probs ? probs[v.head].p : null;
          const c = probToColor(p ?? 0);
          const pos = course.center.clone().add(explodeVec(v.meshName));
          return (
            <Html key={`label-${v.head}`} position={pos} center zIndexRange={[20, 0]} pointerEvents="auto">
              <button
                type="button"
                onClick={() => onSelectVessel(v.head)}
                onDoubleClick={() => onFocusVessel(v.head)}
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

        {hover ? (
          <Html position={hover.local} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <HoverCard head={hover.head} p={probs ? probs[hover.head].p : null} />
          </Html>
        ) : null}
      </group>

      <Controls focusTarget={focusTarget} />
    </>
  );
}

function HoverCard({ head, p }: { head: VesselHead; p: number | null }) {
  const meta = VESSEL_BY_HEAD[head];
  const c = probToColor(p ?? 0);
  return (
    <div className="pointer-events-none flex -translate-y-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-black/85 px-2.5 py-1.5 shadow-xl backdrop-blur">
      <i className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
      <span className="text-[11px] font-bold text-white">{meta?.full ?? head}</span>
      <span className="text-[11px] font-extrabold tabular-nums" style={{ color: c }}>
        {p === null ? "—" : `${Math.round(p * 100)}%`}
      </span>
    </div>
  );
}

interface VesselMeshProps {
  geometry?: THREE.BufferGeometry;
  hitGeometry?: THREE.BufferGeometry;
  head: VesselHead;
  p: number;
  color: string;
  dimmed: boolean;
  isSelected: boolean;
  reduced: boolean;
  onSelect: (head: HeadName) => void;
  onFocus: (head: VesselHead) => void;
  onHover: (head: VesselHead, world: THREE.Vector3 | null) => void;
  explodeOffset: THREE.Vector3;
}

// Risk trunks are true-size tubes hugging the epicardial surface — no
// thickening hack needed (the old source-mesh coronaries were hair-thin).
function VesselMesh({ geometry, hitGeometry, head, p, color, dimmed, isSelected, reduced, onSelect, onFocus, onHover, explodeOffset }: VesselMeshProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(color), [color]);
  const [hover, setHover] = useState(false);
  const t = useRef(0);

  useFrame((_, dt) => {
    if (!mat.current) return;
    mat.current.color.lerp(target, Math.min(1, dt * 6));
    mat.current.emissive.lerp(target, Math.min(1, dt * 6));
    const base = 0.85 + 0.65 * p;
    t.current += dt;
    const pulse = p > 0.6 && !reduced ? 0.72 + 0.28 * Math.sin(t.current * 4.2) : 1;
    mat.current.emissiveIntensity = dimmed ? base * 0.12 : base * pulse;
    mat.current.opacity = dimmed ? 0.18 : 1;
  });

  if (!geometry) return null;

  return (
    <group position={explodeOffset}>
      <mesh
        geometry={geometry}
        scale={hover || isSelected ? 1.14 : 1}
        renderOrder={5}
        castShadow
      >
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={1.1 + 0.5 * p}
          roughness={0.28}
          metalness={0.05}
          transparent={dimmed}
          opacity={1}
          depthWrite={!dimmed}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
        {isSelected ? (
          <lineSegments>
            <edgesGeometry args={[geometry]} />
            <lineBasicMaterial color="#3D7DFF" transparent opacity={0.55} />
          </lineSegments>
        ) : null}
      </mesh>
      {/* fat invisible twin: forgiving hover/click on the slender trunk */}
      {hitGeometry ? (
        <mesh
          geometry={hitGeometry}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(head);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onFocus(head);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            onHover(head, e.point.clone());
          }}
          onPointerOut={() => {
            setHover(false);
            onHover(head, null);
            document.body.style.cursor = "auto";
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

// A single OrbitControls instance. Focusing a vessel (or resetting to null)
// glides the camera target and dollies in; the user grabbing the scene
// cancels the glide but keeps the new target.
const DEFAULT_CAM_POS = new THREE.Vector3(0.35, 0.55, CAMERA_DIST);
const FOCUS_DIST = 2.7;

function Controls({ focusTarget }: { focusTarget: THREE.Vector3 | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desired = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    const tgt = focusTarget ? focusTarget.clone() : new THREE.Vector3(0, 0, 0);
    let pos: THREE.Vector3;
    if (focusTarget) {
      const dir = camera.position.clone().sub(tgt);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
      pos = tgt.clone().add(dir.normalize().multiplyScalar(FOCUS_DIST));
    } else {
      pos = DEFAULT_CAM_POS.clone();
    }
    desired.current = { pos, tgt };
    animating.current = true;
  }, [focusTarget, camera]);

  useFrame(() => {
    if (animating.current && desired.current && controls.current) {
      camera.position.lerp(desired.current.pos, 0.12);
      controls.current.target.lerp(desired.current.tgt, 0.12);
      controls.current.update();
      if (camera.position.distanceTo(desired.current.pos) < 0.02) animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
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
    <div
      className="relative h-full w-full"
      data-testid="heart-scene"
      style={{
        background:
          "radial-gradient(65% 55% at 50% 42%, rgba(164,31,52,0.30) 0%, rgba(30,22,34,0.55) 38%, rgba(11,15,24,0) 70%), radial-gradient(120% 100% at 50% 0%, #16203200 0%, #0B0F18 55%, #070a12 100%), linear-gradient(180deg, #101828 0%, #0B0F18 60%, #080b13 100%)",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop="always"
        shadows
        camera={{ position: [0.35, 0.55, CAMERA_DIST], fov: 38, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => props.onBackgroundClick()}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          if ("outputColorSpace" in gl) {
            (gl as unknown as { outputColorSpace: unknown }).outputColorSpace = THREE.SRGBColorSpace;
          }
        }}
      >
        {/* studio rig: soft ambient + warm key with shadows + cool fill + red rim */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#fff0e6", "#3a1a20", 0.75]} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={2.2}
          color="#fff1e6"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={1}
          shadow-camera-far={15}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-5, 1.5, -3.5]} intensity={0.95} color="#8fb4ff" />
        <directionalLight position={[-1.5, 3.5, -6]} intensity={1.35} color="#ff8a7a" />
        <directionalLight position={[0, -4, 3]} intensity={0.4} color="#ffd9b0" />
        {/* faint warm glow in front of the chambers so crevices read as depth */}
        <pointLight position={[0, 0.4, 2.6]} intensity={3.2} distance={7} decay={1.8} color="#ff9a86" />
        <Suspense fallback={null}>
          <Model
            probs={props.probs}
            selected={props.selected}
            isolate={props.isolate}
            bpm={props.bpm}
            explode={props.explode}
            focus={props.focus}
            onSelectVessel={props.onSelectVessel}
            onFocusVessel={props.onFocusVessel}
            onBackgroundClick={props.onBackgroundClick}
          />
          <ContactShadows position={[0, -1.35, 0]} opacity={0.65} scale={7} blur={2.4} far={2.6} color="#000000" />
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
