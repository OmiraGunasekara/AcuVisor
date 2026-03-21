import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Html, OrbitControls } from "@react-three/drei";

const VIEW_PRESETS = [
  { id: "iso", label: "Iso" },
  { id: "top", label: "Top" },
  { id: "north", label: "North" },
  { id: "south", label: "South" },
  { id: "east", label: "East" },
  { id: "west", label: "West" },
];

function fmt(n, digits = 2) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundCoord(value) {
  return Number(value.toFixed(3));
}

function wallSpanFor(wall, L, W) {
  return wall === "north" || wall === "south" ? L : W;
}

function toRoomLocalPoint(point, L, W, H) {
  if (!point) return null;

  return {
    x: clamp(Number(point.x ?? 0) + L / 2, 0, L),
    y: clamp(Number(point.y ?? 0), 0, H),
    z: clamp(Number(point.z ?? 0) + W / 2, 0, W),
  };
}

function resolveWallRect(item, L, W, H) {
  if (!item?.wall) return null;

  const wallWidth = wallSpanFor(item.wall, L, W);
  const x1 = item.x1_m ?? (item.x1 != null ? Number(item.x1) * wallWidth : null);
  const x2 = item.x2_m ?? (item.x2 != null ? Number(item.x2) * wallWidth : null);
  const z1 = item.z1_m ?? (item.z1 != null ? Number(item.z1) * H : null);
  const z2 = item.z2_m ?? (item.z2 != null ? Number(item.z2) * H : null);

  if (![x1, x2, z1, z2].every((value) => Number.isFinite(value))) {
    return null;
  }

  const startX = clamp(Math.min(x1, x2), 0, wallWidth);
  const endX = clamp(Math.max(x1, x2), 0, wallWidth);
  const startZ = clamp(Math.min(z1, z2), 0, H);
  const endZ = clamp(Math.max(z1, z2), 0, H);

  if (endX - startX <= 0 || endZ - startZ <= 0) {
    return null;
  }

  return {
    wall: item.wall,
    x1: startX,
    x2: endX,
    z1: startZ,
    z2: endZ,
    width: endX - startX,
    height: endZ - startZ,
  };
}

function buildWallItemMesh(item, L, W, H, inset, thickness) {
  const rect = resolveWallRect(item, L, W, H);
  if (!rect) return null;

  switch (rect.wall) {
    case "north":
      return {
        position: [(rect.x1 + rect.x2) / 2, rect.z1 + rect.height / 2, W - inset - thickness / 2],
        size: [rect.width, rect.height, thickness],
      };
    case "south":
      return {
        position: [(rect.x1 + rect.x2) / 2, rect.z1 + rect.height / 2, inset + thickness / 2],
        size: [rect.width, rect.height, thickness],
      };
    case "east":
      return {
        position: [L - inset - thickness / 2, rect.z1 + rect.height / 2, (rect.x1 + rect.x2) / 2],
        size: [thickness, rect.height, rect.width],
      };
    case "west":
      return {
        position: [inset + thickness / 2, rect.z1 + rect.height / 2, (rect.x1 + rect.x2) / 2],
        size: [thickness, rect.height, rect.width],
      };
    default:
      return null;
  }
}

function toMarkerPosition(point) {
  if (!point) return null;
  return [Number(point.x ?? 0), Number(point.z ?? 0), Number(point.y ?? 0)];
}

function SurfaceBox({
  position,
  size,
  color,
  edgeColor,
  opacity,
  metalness = 0.08,
  onClick,
  onPointerMove,
  onPointerOut,
}) {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.55}
        metalness={metalness}
      />
      <Edges color={edgeColor} />
    </mesh>
  );
}

function Marker({ position, color, label }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <Html position={[0, 0.32, 0]} center style={{ pointerEvents: "none" }}>
        <div className="rounded-full border border-white/70 bg-slate-900/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-sm">
          {label}
        </div>
      </Html>
    </group>
  );
}

function WallBadge({ position, label }) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div className="rounded-full border border-slate-300/80 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm backdrop-blur-sm">
        {label}
      </div>
    </Html>
  );
}

function ViewController({ preset, L, W, H, controlsRef }) {
  const { camera } = useThree();

  useEffect(() => {
    const target = [0, Math.max(H * 0.45, 0.9), 0];
    const maxSpan = Math.max(L, W, H, 1);
    let position = [maxSpan * 1.55, Math.max(H * 1.25, 3.2), maxSpan * 1.55];
    let up = [0, 1, 0];

    switch (preset) {
      case "top":
        position = [0, Math.max(maxSpan * 2.6, H + 4), 0.001];
        up = [0, 0, -1];
        break;
      case "north":
        position = [0, Math.max(H * 0.62, 1.6), Math.max(W * 1.95, 3.5)];
        break;
      case "south":
        position = [0, Math.max(H * 0.62, 1.6), -Math.max(W * 1.95, 3.5)];
        break;
      case "east":
        position = [Math.max(L * 1.95, 3.5), Math.max(H * 0.62, 1.6), 0];
        break;
      case "west":
        position = [-Math.max(L * 1.95, 3.5), Math.max(H * 0.62, 1.6), 0];
        break;
      default:
        break;
    }

    camera.position.set(...position);
    camera.up.set(...up);
    camera.lookAt(...target);

    if (controlsRef.current) {
      controlsRef.current.target.set(...target);
      controlsRef.current.update();
    }
  }, [camera, controlsRef, preset, L, W, H]);

  return null;
}

function wallClickToExclusion(wall, roomPoint, L, W, H, widthM, heightM) {
  const safeWidth = Math.max(0.2, Number(widthM || 0.8));
  const safeHeight = Math.max(0.2, Number(heightM || 0.8));

  let x1 = 0;
  let x2 = 0;
  let z1 = 0;
  let z2 = 0;

  switch (wall) {
    case "north":
    case "south": {
      x1 = clamp((roomPoint.x - safeWidth / 2) / L, 0, 1);
      x2 = clamp((roomPoint.x + safeWidth / 2) / L, 0, 1);
      z1 = clamp((roomPoint.y - safeHeight / 2) / H, 0, 1);
      z2 = clamp((roomPoint.y + safeHeight / 2) / H, 0, 1);
      break;
    }
    case "east":
    case "west": {
      x1 = clamp((roomPoint.z - safeWidth / 2) / W, 0, 1);
      x2 = clamp((roomPoint.z + safeWidth / 2) / W, 0, 1);
      z1 = clamp((roomPoint.y - safeHeight / 2) / H, 0, 1);
      z2 = clamp((roomPoint.y + safeHeight / 2) / H, 0, 1);
      break;
    }
    default:
      return null;
  }

  if (x2 - x1 < 0.02 || z2 - z1 < 0.02) return null;

  return {
    wall,
    x1: roundCoord(x1),
    x2: roundCoord(x2),
    z1: roundCoord(z1),
    z2: roundCoord(z2),
  };
}

function RoomScene({
  L,
  W,
  H,
  panels,
  exclusions,
  source,
  listener,
  interactive = false,
  editTool = "none",
  exclusionSize,
  viewPreset,
  onPlaceSource,
  onPlaceListener,
  onAddExclusion,
}) {
  const controlsRef = useRef(null);
  const [hoveredExclusion, setHoveredExclusion] = useState(null);

  const panelMeshes = useMemo(
    () => panels.map((panel) => buildWallItemMesh(panel, L, W, H, 0.03, 0.1)).filter(Boolean),
    [panels, L, W, H]
  );

  const exclusionMeshes = useMemo(
    () => exclusions.map((exclusion) => buildWallItemMesh(exclusion, L, W, H, 0.015, 0.04)).filter(Boolean),
    [exclusions, L, W, H]
  );

  const previewMesh = useMemo(
    () => (hoveredExclusion ? buildWallItemMesh(hoveredExclusion, L, W, H, 0.015, 0.045) : null),
    [hoveredExclusion, L, W, H]
  );

  const sourcePosition = useMemo(() => toMarkerPosition(source), [source]);
  const listenerPosition = useMemo(() => toMarkerPosition(listener), [listener]);

  const clearPreview = () => setHoveredExclusion(null);

  const handleFloorClick = (e) => {
    if (!interactive) return;
    e.stopPropagation();

    const roomPoint = toRoomLocalPoint(e.point, L, W, H);
    if (!roomPoint) return;

    if (editTool === "source" && onPlaceSource) {
      onPlaceSource({
        x: roundCoord(roomPoint.x),
        y: roundCoord(roomPoint.z),
        z: roundCoord(clamp(Number(source?.z ?? Math.min(1.5, H - 0.05)), 0.05, H - 0.05)),
      });
    }

    if (editTool === "listener" && onPlaceListener) {
      onPlaceListener({
        x: roundCoord(roomPoint.x),
        y: roundCoord(roomPoint.z),
        z: roundCoord(clamp(Number(listener?.z ?? Math.min(1.5, H - 0.05)), 0.05, H - 0.05)),
      });
    }
  };

  const handleWallPreview = (wall) => (e) => {
    if (!interactive || editTool !== "exclusion") return;
    e.stopPropagation();

    const roomPoint = toRoomLocalPoint(e.point, L, W, H);
    if (!roomPoint) return;

    const rect = wallClickToExclusion(
      wall,
      roomPoint,
      L,
      W,
      H,
      exclusionSize?.width,
      exclusionSize?.height
    );

    setHoveredExclusion(rect);
  };

  const handleWallClick = (wall) => (e) => {
    if (!interactive || editTool !== "exclusion" || !onAddExclusion) return;
    e.stopPropagation();

    const roomPoint = toRoomLocalPoint(e.point, L, W, H);
    if (!roomPoint) return;

    const rect = wallClickToExclusion(
      wall,
      roomPoint,
      L,
      W,
      H,
      exclusionSize?.width,
      exclusionSize?.height
    );

    if (rect) {
      onAddExclusion(rect);
      setHoveredExclusion(rect);
    }
  };

  const wallLabelHeight = clamp(H * 0.58, 0.8, Math.max(H - 0.2, 0.8));
  const placementLocked = interactive && editTool !== "none";

  return (
    <>
      <ViewController preset={viewPreset} L={L} W={W} H={H} controlsRef={controlsRef} />
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[8, 10, 6]} intensity={1.1} />
      <directionalLight position={[-7, 6, -4]} intensity={0.45} />

      <gridHelper
        args={[Math.max(L, W) + 3, Math.max(Math.ceil(Math.max(L, W) * 2), 10), "#cbd5e1", "#e2e8f0"]}
        position={[0, 0.001, 0]}
      />

      <group position={[-L / 2, 0, -W / 2]}>
        <SurfaceBox
          position={[L / 2, 0.025, W / 2]}
          size={[L, 0.05, W]}
          color="#dbe4ee"
          edgeColor="#9aa9bb"
          opacity={0.92}
          onClick={handleFloorClick}
        />

        <SurfaceBox
          position={[L / 2, H / 2, 0.025]}
          size={[L, H, 0.05]}
          color="#f8fafc"
          edgeColor="#94a3b8"
          opacity={interactive && editTool === "exclusion" ? 0.34 : 0.2}
          onClick={handleWallClick("south")}
          onPointerMove={handleWallPreview("south")}
          onPointerOut={clearPreview}
        />
        <SurfaceBox
          position={[L / 2, H / 2, W - 0.025]}
          size={[L, H, 0.05]}
          color="#e0f2fe"
          edgeColor="#7c97b5"
          opacity={interactive && editTool === "exclusion" ? 0.38 : 0.24}
          onClick={handleWallClick("north")}
          onPointerMove={handleWallPreview("north")}
          onPointerOut={clearPreview}
        />
        <SurfaceBox
          position={[0.025, H / 2, W / 2]}
          size={[0.05, H, W]}
          color="#eef2ff"
          edgeColor="#94a3b8"
          opacity={interactive && editTool === "exclusion" ? 0.38 : 0.24}
          onClick={handleWallClick("west")}
          onPointerMove={handleWallPreview("west")}
          onPointerOut={clearPreview}
        />
        <SurfaceBox
          position={[L - 0.025, H / 2, W / 2]}
          size={[0.05, H, W]}
          color="#ede9fe"
          edgeColor="#94a3b8"
          opacity={interactive && editTool === "exclusion" ? 0.38 : 0.24}
          onClick={handleWallClick("east")}
          onPointerMove={handleWallPreview("east")}
          onPointerOut={clearPreview}
        />
        <SurfaceBox
          position={[L / 2, H - 0.02, W / 2]}
          size={[L, 0.04, W]}
          color="#f8fafc"
          edgeColor="#cbd5e1"
          opacity={0.08}
        />

        <WallBadge position={[L / 2, wallLabelHeight, W + 0.22]} label="North Wall" />
        <WallBadge position={[L / 2, wallLabelHeight, -0.22]} label="South Wall" />
        <WallBadge position={[L + 0.22, wallLabelHeight, W / 2]} label="East Wall" />
        <WallBadge position={[-0.22, wallLabelHeight, W / 2]} label="West Wall" />
        <WallBadge
          position={[L / 2, Math.max(H + 0.22, 0.9), W / 2]}
          label={`${fmt(L)}m x ${fmt(W)}m x ${fmt(H)}m`}
        />

        {previewMesh && interactive && editTool === "exclusion" && (
          <SurfaceBox
            position={previewMesh.position}
            size={previewMesh.size}
            color="#fb923c"
            edgeColor="#ea580c"
            opacity={0.38}
            metalness={0.02}
          />
        )}

        {exclusionMeshes.map((mesh, index) => (
          <SurfaceBox
            key={`exclusion-${index}`}
            position={mesh.position}
            size={mesh.size}
            color="#f87171"
            edgeColor="#dc2626"
            opacity={0.62}
            metalness={0.02}
          />
        ))}

        {panelMeshes.map((mesh, index) => (
          <SurfaceBox
            key={`panel-${index}`}
            position={mesh.position}
            size={mesh.size}
            color="#3b82f6"
            edgeColor="#1d4ed8"
            opacity={0.9}
            metalness={0.1}
          />
        ))}

        {sourcePosition && <Marker position={sourcePosition} color="#10b981" label="Source" />}
        {listenerPosition && <Marker position={listenerPosition} color="#8b5cf6" label="Listener" />}
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={!placementLocked}
        enableZoom
        enableRotate={!placementLocked}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        zoomSpeed={0.9}
        target={[0, Math.max(H * 0.45, 1), 0]}
        minDistance={Math.max(Math.max(L, W), H) * 0.55}
        maxDistance={Math.max(Math.max(L, W), H) * 4}
      />
    </>
  );
}

export default function PanelView({
  L = 5.2,
  W = 4.1,
  H = 2.8,
  recommendation = null,
  exclusions = [],
  source = null,
  listener = null,
  title = "3D Room Viewer",
  interactive = false,
  editTool = "none",
  exclusionSize = { width: 0.8, height: 0.8 },
  onPlaceSource,
  onPlaceListener,
  onAddExclusion,
}) {
  const panels = recommendation?.panels ?? [];
  const responseExclusions = recommendation?.exclusions ?? exclusions ?? [];
  const [viewPreset, setViewPreset] = useState(interactive ? "top" : "iso");

  useEffect(() => {
    if (!interactive) return;

    if (editTool === "source" || editTool === "listener") {
      setViewPreset("top");
      return;
    }

    if (editTool === "exclusion" && viewPreset === "top") {
      setViewPreset("north");
    }
  }, [interactive, editTool, viewPreset]);

  const cameraDistance = Math.max(L, W) * 1.45;
  const cameraHeight = Math.max(H * 1.25, 3.2);
  const roomVolume = Number(L) * Number(W) * Number(H);

  const helperText =
    editTool === "source"
      ? "Top view is selected for accurate source placement. Click the floor to set x/y and fine-tune height from the inputs."
      : editTool === "listener"
      ? "Top view is selected for accurate listener placement. Click the floor to set x/y and fine-tune height from the inputs."
      : editTool === "exclusion"
      ? "Choose a wall view, hover to preview the rectangle, then click to place the exclusion on that wall."
      : "Orbit, zoom, inspect the room, and use the wall labels to understand the directions.";

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500">
            Room: {fmt(L)}m x {fmt(W)}m x {fmt(H)}m
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
            <span className="text-slate-600">Panels</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
            <span className="text-slate-600">Exclusions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Source</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-violet-500" />
            <span className="text-slate-600">Listener</span>
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-slate-600">{helperText}</div>

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setViewPreset(preset.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              viewPreset === preset.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <div className="h-[clamp(18rem,46vh,34rem)]">
          <Canvas
            shadows={false}
            camera={{
              position: [cameraDistance, cameraHeight, cameraDistance],
              fov: 42,
              near: 0.1,
              far: 200,
            }}
          >
            <RoomScene
              L={Number(L)}
              W={Number(W)}
              H={Number(H)}
              panels={panels}
              exclusions={responseExclusions}
              source={source}
              listener={listener}
              interactive={interactive}
              editTool={editTool}
              exclusionSize={exclusionSize}
              viewPreset={viewPreset}
              onPlaceSource={onPlaceSource}
              onPlaceListener={onPlaceListener}
              onAddExclusion={onAddExclusion}
            />
          </Canvas>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Panels</div>
          <div className="text-2xl font-bold text-slate-900">{panels.length}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Exclusions</div>
          <div className="text-2xl font-bold text-slate-900">{responseExclusions.length}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            {recommendation ? "Coverage" : "Room Volume"}
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {recommendation ? `${fmt((recommendation?.metrics?.used_coverage ?? 0) * 100, 1)}%` : `${fmt(roomVolume, 1)}m3`}
          </div>
        </div>
      </div>
    </div>
  );
}
