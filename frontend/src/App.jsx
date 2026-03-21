import React, { useState, useRef, useMemo } from "react";
import { api } from "./api";
import {
  Upload,
  Maximize,
  Box,
  Play,
  Pause,
  CheckCircle,
  BarChart3,
  Download,
  ArrowRight,
  Volume2,
  Layers,
  Info,
  PenTool,
  Eraser,
  Wand2,
  RefreshCw,
  Radio,
  Mic2,
} from "lucide-react";

import PanelView from "./components/PanelView";

// --- CONSTANTS ---
const MATERIALS = {
  painted_plaster: { label: "Painted plaster", a: 0.07 },
  gypsum: { label: "Gypsum board", a: 0.1 },
  concrete: { label: "Concrete", a: 0.03 },
  wood: { label: "Wood", a: 0.2 },
  carpet: { label: "Carpet", a: 0.45 },
  tile: { label: "Tile", a: 0.05 },
  brick: { label: "Brick", a: 0.04 },
  glass: { label: "Glass", a: 0.02 },
  curtain: { label: "Curtain", a: 0.35 },
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function fmt(x, d = 3) {
  return typeof x === "number" && isFinite(x) ? x.toFixed(d) : "-";
}
function normalizeLabel(raw) {
  return raw?.toLowerCase?.().replace(/\s+/g, "_").trim() ?? null;
}

// --- COMPONENTS ---
const Header = () => (
  <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 cursor-pointer select-none"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Layers className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">AcuVisor</span>
      </div>
      <nav className="hidden md:flex gap-6 text-sm text-slate-400">
        <a href="#" className="hover:text-white transition-colors">
          How it Works
        </a>
        <a href="#" className="hover:text-white transition-colors">
          About
        </a>
      </nav>
    </div>
  </header>
);

const Hero = ({ onStart }) => (
  <div className="min-h-[calc(95vh-1.1rem)] flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-slate-900 to-slate-950 text-white animate-fade-in">
    <div className="w-full max-w-4xl space-y-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-800 text-blue-400 text-xs font-medium uppercase tracking-wider">
        AI-Powered Acoustic Engineering
      </div>
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-slate-400">
        Professional Sound.
        <br />
        <span className="text-blue-500">Simplified.</span>
      </h1>
      <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
        Upload a photo, sample your materials, and get optimized panel placement +
        before/after audio.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <button
          onClick={onStart}
          className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 flex items-center gap-2"
        >
          Analyze My Room
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  </div>
);

// --- STEP 1: INPUTS ---
const InputStep = ({
  L,
  setL,
  W,
  setW,
  H,
  setH,
  src_x,
  setSrcX,
  src_y,
  setSrcY,
  src_z,
  setSrcZ,
  mic_x,
  setMicX,
  mic_y,
  setMicY,
  mic_z,
  setMicZ,
  onPickImage,
  imageFile,
  onNext,
}) => {
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onPickImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onPickImage(e.target.files[0]);
    }
  };

  const isFormValid = L && W && H && imageFile;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-slide-up">
      <div className="space-y-2 mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Room Configuration</h2>
        <p className="text-slate-500">
          Enter dimensions, optional source/listener positions, and upload a room photo.
        </p>
      </div>

      <div className="grid gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold">
            <Maximize className="w-5 h-5 text-blue-600" />
            <h3>Room Dimensions (Meters)</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Length", val: L, set: setL },
              { label: "Width", val: W, set: setW },
              { label: "Height", val: H, set: setH },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold">
            <Radio className="w-5 h-5 text-blue-600" />
            <h3>Audio Source Position (Optional)</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These are used for before/after audio generation. Leave as default if unsure.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Source X", val: src_x, set: setSrcX },
              { label: "Source Y", val: src_y, set: setSrcY },
              { label: "Source Z", val: src_z, set: setSrcZ },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold">
            <Mic2 className="w-5 h-5 text-blue-600" />
            <h3>Listener / Microphone Position (Optional)</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These are used for before/after audio generation. Leave as default if unsure.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Listener X", val: mic_x, set: setMicX },
              { label: "Listener Y", val: mic_y, set: setMicY },
              { label: "Listener Z", val: mic_z, set: setMicZ },
            ].map((field) => (
              <div key={field.label} className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold">
            <Upload className="w-5 h-5 text-blue-600" />
            <h3>Room Image</h3>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {imageFile ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{imageFile.name}</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-slate-900 font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-500 mt-1">Supports JPG, PNG</p>
              </>
            )}
          </div>
        </div>

        <button
          disabled={!isFormValid}
          onClick={onNext}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            isFormValid
              ? "bg-blue-600 text-white shadow-lg hover:bg-blue-500"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          Next: Calibration
        </button>
      </div>
    </div>
  );
};

// --- AudioPlayer (real playback) ---
const AudioPlayer = ({ type, label, src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;

    try {
      if (!playing) {
        await el.play();
        setPlaying(true);
      } else {
        el.pause();
        setPlaying(false);
      }
    } catch (e) {
      console.error("Audio play failed:", e);
      alert("Audio blocked or failed. Check console + ensure /static is reachable.");
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
        playing ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            playing
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-1" />}
        </button>
        <div>
          <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            {type}
          </div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
};

// --- CALIBRATION (Drawing Samples + Exclusions) ---
const CalibrationStep = ({
  imageURL,
  mode,
  setMode,
  samples,
  setSamples,
  exclusions,
  setExclusions,
  pendingExcl,
  setPendingExcl,
  override,
  setOverride,
  suggested,
  hasSuggested,
  materialCandidates,
  onSuggestMaterials,
  busy,
  err,
  canRecommend,
  onAnalyze,
  onClearAll,
}) => {
  const overlayRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const getNormPos = (evt) => {
    const box = overlayRef.current.getBoundingClientRect();
    const x = clamp01((evt.clientX - box.left) / box.width);
    const y = clamp01((evt.clientY - box.top) / box.height);
    return { x, y };
  };

  const finalizeRect = (r) => {
    const x1 = Math.min(r.x0, r.x1);
    const x2 = Math.max(r.x0, r.x1);
    const y1 = Math.min(r.y0, r.y1);
    const y2 = Math.max(r.y0, r.y1);
    if (x2 - x1 < 0.03 || y2 - y1 < 0.03) return null;
    return { x1, y1, x2, y2 };
  };

  const onMouseDown = (evt) => {
    if (!mode || !imageURL) return;
    const { x, y } = getNormPos(evt);
    setDrag({ x0: x, y0: y, x1: x, y1: y });
  };

  const onMouseMove = (evt) => {
    if (!drag) return;
    const { x, y } = getNormPos(evt);
    setDrag((d) => ({ ...d, x1: x, y1: y }));
  };

  const onMouseUp = () => {
    if (!drag) return;
    const rect = finalizeRect(drag);
    setDrag(null);
    if (!rect) return;

    if (mode === "exclude") {
      setPendingExcl(rect);
      setMode(null);
      return;
    }

    setSamples((s) => ({ ...s, [mode]: rect }));
    setMode(null);
  };

  const RectOverlay = ({ rect, color, label }) => {
    if (!rect) return null;
    const left = rect.x1 * 100;
    const top = rect.y1 * 100;
    const w = (rect.x2 - rect.x1) * 100;
    const h = (rect.y2 - rect.y1) * 100;
    return (
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          width: `${w}%`,
          height: `${h}%`,
          border: `2px solid ${color}`,
          borderRadius: 6,
          background: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            left: 0,
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 10,
            background: color,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {label}
        </div>
      </div>
    );
  };

  const canSuggest = samples.wall && samples.floor && samples.ceiling;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-slide-up h-[calc(100vh-100px)]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Calibration</h2>
            <p className="text-slate-500 text-sm">
              Draw Wall/Floor/Ceiling samples. Optionally draw exclusions (TV, window, door).
            </p>
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm whitespace-pre-wrap">
              {err}
            </div>
          )}

          <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
              <PenTool className="w-4 h-4" /> Sampling Tools
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "wall", label: "Wall", dot: "bg-blue-600" },
                { id: "floor", label: "Floor", dot: "bg-green-600" },
                { id: "ceiling", label: "Ceiling", dot: "bg-yellow-500" },
                { id: "exclude", label: "Exclude", dot: "bg-red-500" },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setMode(tool.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2 ${
                    mode === tool.id
                      ? "bg-slate-800 text-white border-slate-800 ring-2 ring-offset-1 ring-slate-400"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${tool.dot}`} />
                  {tool.label}
                </button>
              ))}

              <button
                onClick={onClearAll}
                className="col-span-2 text-xs text-red-500 hover:underline flex items-center justify-center gap-1 mt-2"
              >
                <Eraser className="w-3 h-3" /> Clear All
              </button>
            </div>
          </div>

          {pendingExcl && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-800 mb-2">
                Assign exclusion to a wall
              </div>
              <div className="text-xs text-slate-500 mb-3">
                For MVP, exclusion is applied on a chosen wall plane (x,z). Pick the wall this area belongs to.
              </div>

              <div className="grid grid-cols-2 gap-2">
                {["north", "east", "south", "west"].map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      const r = pendingExcl;
                      setExclusions((xs) => [
                        ...xs,
                        {
                          wall: w,
                          x1: r.x1,
                          x2: r.x2,
                          z1: r.y1,
                          z2: r.y2,
                        },
                      ]);
                      setPendingExcl(null);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium"
                  >
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPendingExcl(null)}
                className="mt-3 text-xs text-red-600 hover:underline"
              >
                Cancel exclusion
              </button>
            </div>
          )}

          <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1">
            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4" /> Material Properties
            </h3>

            <button
              disabled={!canSuggest || busy.suggest}
              onClick={onSuggestMaterials}
              className={`w-full py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                busy.suggest
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : canSuggest
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
              }`}
            >
              {busy.suggest ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Auto-Suggest Materials
            </button>

            {!hasSuggested ? (
              <div className="text-sm text-slate-500">
                After drawing Wall/Floor/Ceiling samples, click <b>Auto-Suggest Materials</b>.
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-500">
                  Suggested by AI. Override if incorrect.
                </div>

                <div className="space-y-3 pt-2">
                  {["wall", "floor", "ceiling"].map((surf) => {
                    const sug = suggested?.[surf];
                    const user = override[surf];
                    const changed = sug && user !== sug;
                    const candidates = materialCandidates?.[surf];

                    return (
                      <div key={surf}>
                        <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">
                          {surf}
                        </label>

                        {sug && (
                          <div className="flex items-center justify-between text-xs mb-1">
                            <div className="text-slate-500">
                              Suggested:{" "}
                              <span className="font-semibold text-slate-700">
                                {MATERIALS[sug]?.label ?? sug}
                              </span>{" "}
                              <span className="text-slate-400">
                                (a={MATERIALS[sug]?.a})
                              </span>
                            </div>

                            {changed && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                overridden
                              </span>
                            )}
                          </div>
                        )}

                        <select
                          value={user}
                          onChange={(e) =>
                            setOverride((prev) => ({ ...prev, [surf]: e.target.value }))
                          }
                          className="w-full text-sm p-2 rounded border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {candidates && candidates.length > 0
                            ? candidates.map((cand) => (
                                <option key={cand.label} value={cand.label}>
                                  {(cand.display_name ||
                                    MATERIALS[cand.label]?.label ||
                                    cand.label) +
                                    ` (a=${cand.alpha ?? MATERIALS[cand.label]?.a ?? "?"})` +
                                    (cand.label === sug ? " ⭐" : "")}
                                </option>
                              ))
                            : Object.entries(MATERIALS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label} (a={v.a})
                                </option>
                              ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onAnalyze}
            disabled={busy.rec || !canRecommend}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all ${
              busy.rec || !canRecommend
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-500"
            }`}
          >
            {busy.rec ? "Running Analysis..." : "Generate Recommendations"}
          </button>

          {!canRecommend && (
            <div className="text-xs text-slate-500">
              To generate: enter dimensions + upload image + auto-suggest materials.
              {pendingExcl ? " Also assign the exclusion to a wall." : ""}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden relative shadow-2xl flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {imageURL ? (
              <div className="relative inline-block max-w-full max-h-full">
                <img
                  src={imageURL}
                  alt="Room"
                  className="max-w-full max-h-[80vh] rounded-lg shadow-lg block select-none"
                  draggable={false}
                />
                <div
                  ref={overlayRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  className={`absolute inset-0 z-10 rounded-lg ${
                    mode ? "cursor-crosshair" : "cursor-default"
                  }`}
                >
                  <RectOverlay rect={samples.wall} color="#2563eb" label="WALL" />
                  <RectOverlay rect={samples.floor} color="#16a34a" label="FLOOR" />
                  <RectOverlay rect={samples.ceiling} color="#eab308" label="CEILING" />

                  {exclusions.map((r, i) => (
                    <RectOverlay
                      key={i}
                      rect={{ x1: r.x1, y1: r.z1, x2: r.x2, y2: r.z2 }}
                      color="#ef4444"
                      label={`EXCL ${i + 1} (${r.wall.toUpperCase()})`}
                    />
                  ))}

                  {pendingExcl && (
                    <RectOverlay rect={pendingExcl} color="#ffffff" label="EXCL (choose wall)" />
                  )}

                  {drag &&
                    (() => {
                      const r = finalizeRect(drag);
                      return r ? <RectOverlay rect={r} color="#ffffff" label="Drawing..." /> : null;
                    })()}
                </div>
              </div>
            ) : (
              <div className="text-slate-500">No Image Loaded</div>
            )}

            {mode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border border-slate-700 shadow-xl animate-bounce">
                Draw rectangle for {mode.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- STEP 3: DASHBOARD ---
const Dashboard = ({
  recommendation,
  rt60,
  audio,
  busy,
  onGenerateAudio,
  onReset,
  L,
  W,
  H,
  src_x,
  src_y,
  src_z,
  mic_x,
  mic_y,
  mic_z,
}) => {
  if (!recommendation) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analysis Results</h2>
          <p className="text-slate-500">
            Optimized plan based on geometry + predicted materials.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            New Session
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 font-medium rounded-lg hover:bg-blue-100 transition-colors">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Acoustic Metrics (Predicted)
            </h3>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Panel coverage used</span>
                <span className="font-semibold text-slate-800">
                  {fmt((recommendation.metrics?.used_coverage ?? 0) * 100, 1)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">RT60 before</span>
                <span className="font-semibold text-slate-800">{fmt(rt60?.rt60_before)}s</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">RT60 after</span>
                <span className="font-semibold text-green-600">{fmt(rt60?.rt60_after)}s</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Δ (before − after)</span>
                <span className="font-semibold text-slate-800">{fmt(rt60?.rt60_delta)}s</span>
              </div>

              {!rt60 && (
                <div className="text-xs text-slate-400">
                  (RT60 will appear after recommendations. If blank, check /predict-rt60 endpoint.)
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-blue-600" /> Audio Positions
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Source
                </div>
                <div className="font-mono text-slate-800">
                  x={fmt(Number(src_x), 2)}, y={fmt(Number(src_y), 2)}, z={fmt(Number(src_z), 2)}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Listener
                </div>
                <div className="font-mono text-slate-800">
                  x={fmt(Number(mic_x), 2)}, y={fmt(Number(mic_y), 2)}, z={fmt(Number(mic_z), 2)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-900">Auralization</h3>
            </div>

            {!audio ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-4">
                  Generate a before/after simulation using the predicted room response.
                </p>
                <button
                  onClick={onGenerateAudio}
                  disabled={busy.audio}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy.audio ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Generate Audio Simulation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <AudioPlayer
                  type="Clap Test"
                  label="Before"
                  src={`http://127.0.0.1:8000${audio.clap_before_audio}`}
                />
                <AudioPlayer
                  type="Clap Test"
                  label="After"
                  src={`http://127.0.0.1:8000${audio.clap_after_audio}`}
                />
                <div className="border-t border-slate-100 my-2" />
                <AudioPlayer
                  type="Speech"
                  label="Before"
                  src={`http://127.0.0.1:8000${audio.speech_before_audio}`}
                />
                <AudioPlayer
                  type="Speech"
                  label="After"
                  src={`http://127.0.0.1:8000${audio.speech_after_audio}`}
                />
              </div>
            )}

            {audio && (
              <div className="mt-3 text-xs text-slate-400">
                If playback fails: open the audio URL in a new tab and confirm it downloads/plays.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" /> Recommended Treatment Plan
          </h3>

          <PanelView
            L={Number(L)}
            W={Number(W)}
            H={Number(H)}
            recommendation={recommendation}
            exclusions={recommendation?.exclusions || []}
            source={{
              x: Number(src_x),
              y: Number(src_y),
              z: Number(src_z),
            }}
            listener={{
              x: Number(mic_x),
              y: Number(mic_y),
              z: Number(mic_z),
            }}
            title="3D Room Viewer"
          />

          <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>MVP note:</strong> Exclusions are applied as constraints per chosen wall plane. Full 3D reconstruction from a single image is future work.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [step, setStep] = useState(0);

  // Room inputs
  const [L, setL] = useState(5.2);
  const [W, setW] = useState(4.1);
  const [H, setH] = useState(2.8);

  // Source / listener state
  const [src_x, setSrcX] = useState(1.3);
  const [src_y, setSrcY] = useState(1.0);
  const [src_z, setSrcZ] = useState(1.5);

  const [mic_x, setMicX] = useState(2.6);
  const [mic_y, setMicY] = useState(2.05);
  const [mic_z, setMicZ] = useState(1.5);

  const [imageFile, setImageFile] = useState(null);
  const [imageURL, setImageURL] = useState("");

  // Calibration drawing
  const [mode, setMode] = useState(null); // wall|floor|ceiling|exclude
  const [samples, setSamples] = useState({ wall: null, floor: null, ceiling: null });

  const [exclusions, setExclusions] = useState([]);
  const [pendingExcl, setPendingExcl] = useState(null);

  // Materials
  const [override, setOverride] = useState({
    wall: "painted_plaster",
    floor: "wood",
    ceiling: "painted_plaster",
  });

  const [suggested, setSuggested] = useState({ wall: null, floor: null, ceiling: null });
  const [hasSuggested, setHasSuggested] = useState(false);
  const [materialCandidates, setMaterialCandidates] = useState({
    wall: null,
    floor: null,
    ceiling: null,
  });

  // Results
  const [busy, setBusy] = useState({ suggest: false, rec: false, audio: false });
  const [err, setErr] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [rt60, setRt60] = useState(null);
  const [audio, setAudio] = useState(null);

  const wall_a = useMemo(() => MATERIALS[override.wall]?.a || 0.07, [override.wall]);
  const floor_a = useMemo(() => MATERIALS[override.floor]?.a || 0.2, [override.floor]);
  const ceil_a = useMemo(() => MATERIALS[override.ceiling]?.a || 0.07, [override.ceiling]);

  const hasDims = Number(L) > 0 && Number(W) > 0 && Number(H) > 0;
  const hasImage = !!imageFile;
  const canRecommend = hasDims && hasImage && hasSuggested && !pendingExcl;

  const onPickImage = (file) => {
    setImageFile(file);
    setImageURL(URL.createObjectURL(file));

    setSamples({ wall: null, floor: null, ceiling: null });
    setExclusions([]);
    setPendingExcl(null);

    setOverride({ wall: "painted_plaster", floor: "wood", ceiling: "painted_plaster" });
    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });

    setRecommendation(null);
    setRt60(null);
    setAudio(null);
    setErr("");
  };

  const onClearAll = () => {
    setSamples({ wall: null, floor: null, ceiling: null });
    setExclusions([]);
    setPendingExcl(null);

    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });

    setErr("");
  };

  const callSuggestOne = async (surface) => {
    const rect = samples[surface];
    if (!rect) throw new Error(`Draw a ${surface} sample rectangle first.`);

    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;

    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("surface", surface);
    fd.append("x", String(cx));
    fd.append("y", String(cy));
    fd.append("box_size", String(256));

    return await api.suggestMaterial(fd);
  };

  const onSuggestMaterials = async () => {
    setErr("");
    setBusy((b) => ({ ...b, suggest: true }));

    try {
      const wallRes = await callSuggestOne("wall");
      const floorRes = await callSuggestOne("floor");
      const ceilRes = await callSuggestOne("ceiling");

      const extractLabel = (res) =>
        res?.suggested_label ?? res?.predicted_label ?? res?.label ?? null;

      const mapLabel = (res, fallback) => {
        const raw = extractLabel(res);
        const norm = normalizeLabel(raw);
        return norm && MATERIALS[norm] ? norm : fallback;
      };

      const wallLabel = mapLabel(wallRes, override.wall);
      const floorLabel = mapLabel(floorRes, override.floor);
      const ceilLabel = mapLabel(ceilRes, override.ceiling);

      setMaterialCandidates({
        wall: wallRes?.candidates || null,
        floor: floorRes?.candidates || null,
        ceiling: ceilRes?.candidates || null,
      });

      setOverride({ wall: wallLabel, floor: floorLabel, ceiling: ceilLabel });
      setSuggested({ wall: wallLabel, floor: floorLabel, ceiling: ceilLabel });
      setHasSuggested(true);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, suggest: false }));
    }
  };

  const onRecommendPanels = async () => {
    setErr("");
    setBusy((b) => ({ ...b, rec: true }));

    try {
      if (!canRecommend) {
        throw new Error(
          "Missing required steps. Make sure you auto-suggest materials and assign any pending exclusion wall."
        );
      }

      const payload = {
        L: Number(L),
        W: Number(W),
        H: Number(H),
        wall_a: Number(wall_a),
        floor_a: Number(floor_a),
        ceil_a: Number(ceil_a),
        target_coverage: 0.5,
        exclusions: exclusions,
      };

      const res = await api.recommendPanels(payload);
      setRecommendation(res);

      try {
        const rtReq = {
          L: Number(L),
          W: Number(W),
          H: Number(H),
          wall_a: Number(wall_a),
          floor_a: Number(floor_a),
          ceil_a: Number(ceil_a),
          panel_coverage: Number(res.metrics?.used_coverage ?? 0.5),
        };
        const rtRes = await api.predictRt60(rtReq);
        setRt60(rtRes);
      } catch (rtErr) {
        console.warn("predict-rt60 failed:", rtErr);
        setRt60(null);
      }

      setStep(3);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, rec: false }));
    }
  };

  const onGenerateAudio = async () => {
    setErr("");
    setBusy((b) => ({ ...b, audio: true }));

    try {
      if (!recommendation?.panels || recommendation.panels.length === 0) {
        throw new Error("No panels to simulate.");
      }

      const payload = {
        L: Number(L),
        W: Number(W),
        H: Number(H),
        wall_a: Number(wall_a),
        floor_a: Number(floor_a),
        ceil_a: Number(ceil_a),
        panels: recommendation.panels,
        src_x: Number(src_x),
        src_y: Number(src_y),
        src_z: Number(src_z),
        mic_x: Number(mic_x),
        mic_y: Number(mic_y),
        mic_z: Number(mic_z),
      };

      const res = await api.generateAudio(payload);
      setAudio(res);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy((b) => ({ ...b, audio: false }));
    }
  };

  const handleReset = () => {
    setStep(0);
    setImageFile(null);
    setImageURL("");

    setSamples({ wall: null, floor: null, ceiling: null });
    setExclusions([]);
    setPendingExcl(null);

    setOverride({ wall: "painted_plaster", floor: "wood", ceiling: "painted_plaster" });
    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });

    setRecommendation(null);
    setRt60(null);
    setAudio(null);
    setErr("");

    setL(5.2);
    setW(4.1);
    setH(2.8);

    setSrcX(1.3);
    setSrcY(1.0);
    setSrcZ(1.5);

    setMicX(2.6);
    setMicY(2.05);
    setMicZ(1.5);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <Header />

      <main>
        {step === 0 && <Hero onStart={() => setStep(1)} />}

        {step === 1 && (
          <InputStep
            L={L}
            setL={setL}
            W={W}
            setW={setW}
            H={H}
            setH={setH}
            src_x={src_x}
            setSrcX={setSrcX}
            src_y={src_y}
            setSrcY={setSrcY}
            src_z={src_z}
            setSrcZ={setSrcZ}
            mic_x={mic_x}
            setMicX={setMicX}
            mic_y={mic_y}
            setMicY={setMicY}
            mic_z={mic_z}
            setMicZ={setMicZ}
            imageFile={imageFile}
            onPickImage={onPickImage}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <CalibrationStep
            imageURL={imageURL}
            mode={mode}
            setMode={setMode}
            samples={samples}
            setSamples={setSamples}
            exclusions={exclusions}
            setExclusions={setExclusions}
            pendingExcl={pendingExcl}
            setPendingExcl={setPendingExcl}
            override={override}
            setOverride={setOverride}
            suggested={suggested}
            hasSuggested={hasSuggested}
            materialCandidates={materialCandidates}
            onSuggestMaterials={onSuggestMaterials}
            busy={busy}
            err={err}
            canRecommend={canRecommend}
            onAnalyze={onRecommendPanels}
            onClearAll={onClearAll}
          />
        )}

        {step === 3 && (
          <Dashboard
            recommendation={recommendation}
            rt60={rt60}
            audio={audio}
            busy={busy}
            onGenerateAudio={onGenerateAudio}
            onReset={handleReset}
            src_x={src_x}
            src_y={src_y}
            src_z={src_z}
            mic_x={mic_x}
            mic_y={mic_y}
            mic_z={mic_z}
            L={L}
            W={W}
            H={H}
          />
        )}
      </main>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
