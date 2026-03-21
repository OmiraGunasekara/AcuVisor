import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";

function fmt(n, digits = 2) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function buildWallItemMesh(item, L, W, inset, thickness) {
  const y1 = item.z1_m ?? 0;
  const y2 = item.z2_m ?? 0;
  const height = Math.max(0, y2 - y1);

  if (height <= 0) return null;

  switch (item.wall) {
    case "north": {
      const x1 = item.x1_m ?? 0;
      const x2 = item.x2_m ?? 0;
      const width = Math.max(0, x2 - x1);
      if (width <= 0) return null;
      return {
        position: [(x1 + x2) / 2, y1 + height / 2, W - inset - thickness / 2],
        size: [width, height, thickness],
      };
    }
    case "south": {
      const x1 = item.x1_m ?? 0;
      const x2 = item.x2_m ?? 0;
      const width = Math.max(0, x2 - x1);
      if (width <= 0) return null;
      return {
        position: [(x1 + x2) / 2, y1 + height / 2, inset + thickness / 2],
        size: [width, height, thickness],
      };
    }
    case "east": {
      const z1 = item.x1_m ?? 0;
      const z2 = item.x2_m ?? 0;
      const depth = Math.max(0, z2 - z1);
      if (depth <= 0) return null;
      return {
        position: [L - inset - thickness / 2, y1 + height / 2, (z1 + z2) / 2],
        size: [thickness, height, depth],
      };
    }
    case "west": {
      const z1 = item.x1_m ?? 0;
      const z2 = item.x2_m ?? 0;
      const depth = Math.max(0, z2 - z1);
      if (depth <= 0) return null;
      return {
        position: [inset + thickness / 2, y1 + height / 2, (z1 + z2) / 2],
        size: [thickness, height, depth],
      };
    }
    default:
      return null;
  }
}

function toMarkerPosition(point) {
  if (!point) return null;
  return [Number(point.x ?? 0), Number(point.z ?? 0), Number(point.y ?? 0)];
}

function SurfaceBox({ position, size, color, edgeColor, opacity, metalness = 0.08 }) {
  return (
    <mesh position={position}>
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

function Marker({ position, color }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.12, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
    </mesh>
  );
}

function RoomScene({ L, W, H, panels, exclusions, source, listener }) {
  const panelMeshes = useMemo(
    () => panels.map((panel) => buildWallItemMesh(panel, L, W, 0.03, 0.1)).filter(Boolean),
    [panels, L, W]
  );

  const exclusionMeshes = useMemo(
    () => exclusions
      .map((exclusion) => buildWallItemMesh(exclusion, L, W, 0.015, 0.04))
      .filter(Boolean),
    [exclusions, L, W]
  );

  const sourcePosition = useMemo(() => toMarkerPosition(source), [source]);
  const listenerPosition = useMemo(() => toMarkerPosition(listener), [listener]);

  return (
    <>
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
        />
        <SurfaceBox
          position={[L / 2, H / 2, 0.025]}
          size={[L, H, 0.05]}
          color="#f8fafc"
          edgeColor="#94a3b8"
          opacity={0.2}
        />
        <SurfaceBox
          position={[L / 2, H / 2, W - 0.025]}
          size={[L, H, 0.05]}
          color="#e0f2fe"
          edgeColor="#7c97b5"
          opacity={0.24}
        />
        <SurfaceBox
          position={[0.025, H / 2, W / 2]}
          size={[0.05, H, W]}
          color="#eef2ff"
          edgeColor="#94a3b8"
          opacity={0.24}
        />
        <SurfaceBox
          position={[L - 0.025, H / 2, W / 2]}
          size={[0.05, H, W]}
          color="#ede9fe"
          edgeColor="#94a3b8"
          opacity={0.24}
        />
        <SurfaceBox
          position={[L / 2, H - 0.02, W / 2]}
          size={[L, 0.04, W]}
          color="#f8fafc"
          edgeColor="#cbd5e1"
          opacity={0.08}
        />

        {exclusionMeshes.map((mesh, index) => (
          <SurfaceBox
            key={`exclusion-${index}`}
            position={mesh.position}
            size={mesh.size}
            color="#f87171"
            edgeColor="#dc2626"
            opacity={0.55}
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

        {sourcePosition && <Marker position={sourcePosition} color="#10b981" />}
        {listenerPosition && <Marker position={listenerPosition} color="#8b5cf6" />}
      </group>

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.08}
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
  recommendation,
  exclusions = [],
  source = null,
  listener = null,
  title = "3D Room Viewer",
}) {
  const panels = recommendation?.panels ?? [];
  const responseExclusions = recommendation?.exclusions ?? exclusions ?? [];

  if (!recommendation) return null;

  const cameraDistance = Math.max(L, W) * 1.45;
  const cameraHeight = Math.max(H * 1.25, 3.2);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500">
            Room: {fmt(L)}m x {fmt(W)}m x {fmt(H)}m
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
            <span className="text-slate-600">Panels</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
            <span className="text-slate-600">Exclusions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-600">Source</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" />
            <span className="text-slate-600">Listener</span>
          </div>
          <div className="text-slate-500">Drag to orbit</div>
          <div className="text-slate-500">Scroll to zoom</div>
          <div className="text-slate-500">Right-drag to pan</div>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        <div className="h-[440px] md:h-[560px]">
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
            />
          </Canvas>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Panels</div>
          <div className="text-2xl font-bold text-slate-900">{panels.length}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Exclusions</div>
          <div className="text-2xl font-bold text-slate-900">{responseExclusions.length}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Coverage</div>
          <div className="text-2xl font-bold text-slate-900">
            {fmt((recommendation?.metrics?.used_coverage ?? 0) * 100, 1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

