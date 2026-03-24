import React, { useState, useRef, useMemo, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import {
  Upload,
  Maximize,
  Box,
  Play,
  Pause,
  Check,
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
  Trash2,
} from "lucide-react";

import PanelView from "./components/PanelView";
import AboutPage from "./pages/AboutPage";
import HowItWorksPage from "./pages/HowItWorksPage";

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

const FLOW_STEPS = [
  { id: 1, label: "Room Setup", hint: "Dimensions and photo" },
  { id: 2, label: "Materials", hint: "Surface detection" },
  { id: 3, label: "Layout", hint: "Source, listener, exclusions" },
  { id: 4, label: "Results", hint: "Panels and audio preview" },
];

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function fmt(x, d = 3) {
  return typeof x === "number" && isFinite(x) ? x.toFixed(d) : "-";
}
function normalizeLabel(raw) {
  return raw?.toLowerCase?.().replace(/\s+/g, "_").trim() ?? null;
}

function wallLabelForReport(wall) {
  switch (wall) {
    case "north":
      return "North Wall";
    case "south":
      return "South Wall";
    case "east":
      return "East Wall";
    case "west":
      return "West Wall";
    default:
      return "Wall";
  }
}

function wallSpanForReport(wall, L, W) {
  return wall === "north" || wall === "south" ? Number(L) : Number(W);
}

function resolveWallRectForReport(item, L, W, H) {
  if (!item?.wall) return null;

  const wallWidth = wallSpanForReport(item.wall, L, W);
  const x1 = item.x1_m ?? (item.x1 != null ? Number(item.x1) * wallWidth : null);
  const x2 = item.x2_m ?? (item.x2 != null ? Number(item.x2) * wallWidth : null);
  const z1 = item.z1_m ?? (item.z1 != null ? Number(item.z1) * Number(H) : null);
  const z2 = item.z2_m ?? (item.z2 != null ? Number(item.z2) * Number(H) : null);

  if (![x1, x2, z1, z2].every((value) => Number.isFinite(value))) {
    return null;
  }

  const width = Math.max(Math.abs(x2 - x1), 0);
  const height = Math.max(Math.abs(z2 - z1), 0);
  if (width <= 0 || height <= 0) return null;

  return {
    wallLabel: wallLabelForReport(item.wall),
    width,
    height,
    area: width * height,
  };
}

function formatPointForReport(point) {
  if (!point) return "Not set";
  return `x ${fmt(Number(point.x), 2)}m, y ${fmt(Number(point.y), 2)}m, z ${fmt(Number(point.z), 2)}m`;
}

function buildPanelRowsForReport(panels, L, W, H) {
  return (panels ?? [])
    .map((panel, index) => {
      const rect = resolveWallRectForReport(panel, L, W, H);
      if (!rect) return null;

      return `Panel ${index + 1}: ${rect.wallLabel}, ${fmt(rect.width, 2)}m x ${fmt(rect.height, 2)}m (${fmt(rect.area, 2)} m^2)`;
    })
    .filter(Boolean);
}

function buildReportFilename() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `acuvisor-report-${timestamp}.pdf`;
}

function buildPdfReport({
  recommendation,
  rt60,
  audio,
  L,
  W,
  H,
  source,
  listener,
  snapshotDataUrl,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (heightNeeded = 16) => {
    if (y + heightNeeded <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const writeSectionTitle = (title, { spaceAbove = 18 } = {}) => {
    ensureSpace(28 + (y > margin ? spaceAbove : 0));
    if (y > margin) {
      y += spaceAbove;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
  };

  const writeKeyValue = (label, value) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), margin + 125, y);
    y += 15;
  };

  const writeParagraph = (text) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 12 + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 4;
  };

  const panelRows = buildPanelRowsForReport(recommendation?.panels ?? [], L, W, H);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y, contentWidth, 74, 16, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("AcuVisor Acoustic Report", margin + 20, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin + 20, y + 47);
  doc.text("Room optimization summary with 3D treatment snapshot.", margin + 20, y + 62);
  y += 96;

  writeSectionTitle("Project Summary", { spaceAbove: 0 });
  writeKeyValue("Room dimensions", `${fmt(Number(L), 2)}m x ${fmt(Number(W), 2)}m x ${fmt(Number(H), 2)}m`);
  writeKeyValue("Source position", formatPointForReport(source));
  writeKeyValue("Listener position", formatPointForReport(listener));
  writeKeyValue("Recommended panels", recommendation?.panels?.length ?? 0);
  writeKeyValue("Manual exclusions", recommendation?.exclusions?.length ?? 0);
  writeKeyValue("Source clearance zones", recommendation?.source_clearance_zones?.length ?? 0);

  if (snapshotDataUrl) {
    const imageProps = doc.getImageProperties(snapshotDataUrl);
    const imageWidth = contentWidth;
    const imageHeight = Math.min((imageProps.height * imageWidth) / imageProps.width, 280);

    writeSectionTitle("3D Treatment Snapshot");
    ensureSpace(imageHeight + 12);
    doc.addImage(snapshotDataUrl, "PNG", margin, y, imageWidth, imageHeight, undefined, "FAST");
    y += imageHeight + 18;
  }

  writeSectionTitle("Materials");
  writeKeyValue("Wall", recommendation?.materials?.wall ?? "-");
  writeKeyValue("Floor", recommendation?.materials?.floor ?? "-");
  writeKeyValue("Ceiling", recommendation?.materials?.ceiling ?? "-");

  writeSectionTitle("Predicted Acoustic Metrics");
  writeKeyValue("Panel coverage used", `${fmt((recommendation?.metrics?.used_coverage ?? 0) * 100, 1)}%`);
  writeKeyValue("RT60 before", `${fmt(rt60?.rt60_before, 3)}s`);
  writeKeyValue("RT60 after", `${fmt(rt60?.rt60_after, 3)}s`);
  writeKeyValue("RT60 delta", `${fmt(rt60?.rt60_delta, 3)}s`);
  writeKeyValue("Audio preview", audio ? `Generated (${audio.speech_label || "Speech Sample"})` : "Not generated");

  writeSectionTitle("Recommended Panels");
  if (panelRows.length === 0) {
    writeParagraph("No panel recommendations were available when this report was generated.");
  } else {
    for (const row of panelRows) {
      writeParagraph(row);
    }
  }

  return doc;
}

// --- COMPONENTS ---
function navLinkClassName({ isActive }) {
  return `text-sm transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`;
}

const Header = () => (
  <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 text-white">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
      <a href="/" className="flex items-center gap-2 select-none">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">AcuVisor</span>
      </a>
      <nav className="hidden md:flex gap-6 text-sm">
        <NavLink to="/how-it-works" className={navLinkClassName}>
          How It Works
        </NavLink>
        <NavLink to="/about" className={navLinkClassName}>
          About
        </NavLink>
      </nav>
    </div>
  </header>
);

const StepProgress = ({ step }) => {
  const activeStep = Math.min(Math.max(step, 1), FLOW_STEPS.length);
  const lineInset = FLOW_STEPS.length > 1 ? 100 / (FLOW_STEPS.length * 2) : 0;
  const lineWidth = 100 - lineInset * 2;
  const connectorProgress =
    FLOW_STEPS.length > 1 ? ((activeStep - 1) / (FLOW_STEPS.length - 1)) * lineWidth : lineWidth;
  const contentWidthClass = activeStep <= 2 ? "max-w-4xl" : "max-w-7xl";

  return (
    <div className={`${contentWidthClass} mx-auto px-4 pt-8 pb-2`}>
      <div className="relative grid grid-cols-4 gap-2">
        <div
          className="pointer-events-none absolute top-5 h-[3px] rounded-full bg-slate-200"
          style={{ left: `${lineInset}%`, width: `${lineWidth}%` }}
        />
        <div
          className="pointer-events-none absolute top-5 h-[3px] rounded-full bg-blue-500 transition-all duration-500"
          style={{ left: `${lineInset}%`, width: `${connectorProgress}%` }}
        />

        {FLOW_STEPS.map((flowStep) => {
          const isDone = flowStep.id < activeStep;
          const isActive = flowStep.id === activeStep;

          return (
            <div key={flowStep.id} className="relative z-10 flex flex-col items-center text-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                  isActive
                    ? "border-blue-500 bg-blue-500 text-white ring-4 ring-blue-100"
                    : isDone
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-blue-500 bg-white text-blue-500"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : flowStep.id}
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${isActive ? "text-slate-900" : "text-slate-600"}`}>
                {flowStep.label}
              </div>
              <div className="hidden text-[10px] text-slate-400 sm:block">{flowStep.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Hero = ({ onStart }) => (
  <div className="min-h-[calc(100dvh-4rem-1px)] flex flex-col items-center justify-center px-4 py-10 text-center bg-gradient-to-b from-slate-900 to-slate-950 text-white animate-fade-in">
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
        Upload a photo, confirm materials, place source/listener/exclusions in 3D, and get optimized acoustic treatment.
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

const InputStep = ({ L, setL, W, setW, H, setH, onPickImage, imageFile, onNext }) => {
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
        <p className="text-slate-500">Enter dimensions and upload a room photo.</p>
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
                <label className="text-xs font-medium text-slate-500 uppercase">{field.label}</label>
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
                <p className="text-slate-900 font-medium">Click to upload or drag and drop</p>
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
          Next: Material Suggestion
        </button>
      </div>
    </div>
  );
};

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
          <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">{type}</div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="auto" onEnded={() => setPlaying(false)} />
    </div>
  );
};

const MaterialStep = ({
  imageURL,
  mode,
  setMode,
  samples,
  setSamples,
  override,
  setOverride,
  suggested,
  hasSuggested,
  materialCandidates,
  onSuggestMaterials,
  busy,
  err,
  onClearAll,
  onNext,
  autoSurfaceResult,
  surfaceDetectionBusy,
  useManualMaterialFlow,
  setUseManualMaterialFlow,
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
  const canContinue = hasSuggested;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 lg:py-8 animate-slide-up min-h-[calc(100dvh-4rem-1px)] lg:h-[calc(100dvh-4rem-1px)]">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:h-full">
        <div className="flex flex-col gap-6 lg:col-span-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Material Suggestion</h2>
            <p className="text-slate-500 text-sm">
              CV tries to detect wall, floor, and ceiling first. You can always switch to manual region selection if the result looks wrong.
            </p>
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm whitespace-pre-wrap">
              {err}
            </div>
          )}

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
                Auto Surface Detection
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The system first tries to detect wall, floor, and ceiling automatically.
                You can still switch to manual region selection at any time.
              </p>
            </div>

            {surfaceDetectionBusy ? (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Detecting room surfaces...
              </div>
            ) : autoSurfaceResult ? (
              <>
                <div className="grid gap-2 text-xs">
                  {["wall", "floor", "ceiling"].map((key) => {
                    const surface = autoSurfaceResult?.surfaces?.[key];
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="font-semibold text-slate-700 uppercase">{key}</div>
                        {surface ? (
                          <div className="text-slate-500 mt-1">
                            area={fmt(surface.mask_area_ratio, 3)} | conf={fmt(surface.confidence, 3)}
                          </div>
                        ) : (
                          <div className="text-red-500 mt-1">Not detected</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {autoSurfaceResult?.fallback_required && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Detection looks weak or incomplete. Manual selection is recommended.
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setUseManualMaterialFlow(false)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border ${
                      !useManualMaterialFlow
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Use Auto-Detected Regions
                  </button>

                  <button
                    type="button"
                    onClick={() => setUseManualMaterialFlow(true)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border ${
                      useManualMaterialFlow
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Use Manual Selection
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">No auto-detection result yet.</div>
            )}
          </div>

          {useManualMaterialFlow && (
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                <PenTool className="w-4 h-4" /> Sampling Tools
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "wall", label: "Wall", dot: "bg-blue-600" },
                  { id: "floor", label: "Floor", dot: "bg-green-600" },
                  { id: "ceiling", label: "Ceiling", dot: "bg-yellow-500" },
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
              {busy.suggest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Auto-Suggest Materials
            </button>

            {!hasSuggested ? (
              <div className="text-xs text-slate-500">
                After surface detection or manual sampling, click <b>Auto-Suggest Materials</b>.
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
                              <span className="text-slate-400">(a={MATERIALS[sug]?.a})</span>
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
            onClick={onNext}
            disabled={!canContinue}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all ${
              canContinue
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Next: 3D Room Editor
          </button>
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
                  className={`absolute inset-0 z-10 rounded-lg ${useManualMaterialFlow && mode ? "cursor-crosshair" : "cursor-default"}`}
                  onMouseDown={useManualMaterialFlow ? onMouseDown : undefined}
                  onMouseMove={useManualMaterialFlow ? onMouseMove : undefined}
                  onMouseUp={useManualMaterialFlow ? onMouseUp : undefined}
                  ref={overlayRef}
                >
                  <RectOverlay rect={samples.wall} color="#2563eb" label="WALL" />
                  <RectOverlay rect={samples.floor} color="#16a34a" label="FLOOR" />
                  <RectOverlay rect={samples.ceiling} color="#eab308" label="CEILING" />
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

            {useManualMaterialFlow && mode && (
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

const EditorStep = ({
  L,
  W,
  H,
  source,
  setSource,
  listener,
  setListener,
  exclusions,
  setExclusions,
  busy,
  onBack,
  onNext,
}) => {
  const [editTool, setEditTool] = useState("source");
  const [exWidth, setExWidth] = useState(0.8);
  const [exHeight, setExHeight] = useState(0.8);

  const clampPointValue = (rawValue, max) => {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return 0.05;
    return Number(Math.max(0.05, Math.min(numeric, Math.max(Number(max) - 0.05, 0.05))).toFixed(2));
  };

  const updatePoint = (setter, axis, value, max) => {
    setter((prev) => ({
      ...prev,
      [axis]: clampPointValue(value, max),
    }));
  };

  const renderPointEditor = (label, point, setPoint, tone, tool) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">x = room length, y = room width, z = height. Use floor clicks for x/y and side-wall clicks for height.</div>
        </div>
        <button
          type="button"
          onClick={() => setEditTool(tool)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${tone}`}
        >
          Place In 3D
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            X ({fmt(Number(L), 1)}m max)
          </label>
          <input
            type="number"
            min="0.05"
            max={Math.max(Number(L) - 0.05, 0.05)}
            step="0.1"
            value={point.x}
            onChange={(e) => updatePoint(setPoint, "x", e.target.value, L)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Y ({fmt(Number(W), 1)}m max)
          </label>
          <input
            type="number"
            min="0.05"
            max={Math.max(Number(W) - 0.05, 0.05)}
            step="0.1"
            value={point.y}
            onChange={(e) => updatePoint(setPoint, "y", e.target.value, W)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Z ({fmt(Number(H), 1)}m max)
          </label>
          <input
            type="number"
            min="0.05"
            max={Math.max(Number(H) - 0.05, 0.05)}
            step="0.1"
            value={point.z}
            onChange={(e) => updatePoint(setPoint, "z", e.target.value, H)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-slide-up">
      <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">3D Room Editor</h2>
            <p className="text-slate-500 text-sm">
              The room box uses your L x W x H dimensions directly. Place source/listener from the floor and side walls, and use right-drag to orbit while editing.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">Editing Tools</h3>
              <p className="mt-1 text-sm text-slate-500">
                Floor clicks set source/listener x/y, side-wall clicks set height plus the remaining axis, and the number inputs still work for exact values. Exclusions are added by clicking directly on a wall.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setEditTool("source")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  editTool === "source"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Place Source
              </button>
              <button
                onClick={() => setEditTool("listener")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  editTool === "listener"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Place Listener
              </button>
              <button
                onClick={() => setEditTool("exclusion")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  editTool === "exclusion"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Add Exclusion
              </button>
            </div>

            {editTool === "exclusion" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 text-sm font-semibold text-amber-900">Exclusion Size Preview</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-amber-800 block mb-1">
                      Width On Wall (m)
                    </label>
                    <input
                      type="number"
                      min="0.2"
                      step="0.1"
                      value={exWidth}
                      onChange={(e) => setExWidth(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-amber-800 block mb-1">
                      Height On Wall (m)
                    </label>
                    <input
                      type="number"
                      min="0.2"
                      step="0.1"
                      value={exHeight}
                      onChange={(e) => setExHeight(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white"
                    />
                  </div>
                </div>
                <div className="mt-3 text-xs text-amber-800">
                  Hover a wall in the 3D room to preview the rectangle, then click to place it.
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Current Placements</h3>

            <div className="grid gap-4 md:grid-cols-2">
              {renderPointEditor(
                "Sound Source",
                source,
                setSource,
                "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                "source"
              )}
              {renderPointEditor(
                "Listener",
                listener,
                setListener,
                "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
                "listener"
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">Exclusions ({exclusions.length})</div>

              {exclusions.length === 0 ? (
                <div className="text-sm text-slate-400">No exclusions added yet.</div>
              ) : (
                <div className="space-y-2">
                  {exclusions.map((ex, idx) => {
                    const wallSpan = ex.wall === "north" || ex.wall === "south" ? Number(L) : Number(W);
                    const widthM = (Number(ex.x2) - Number(ex.x1)) * wallSpan;
                    const heightM = (Number(ex.z2) - Number(ex.z1)) * Number(H);

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            {ex.wall} wall
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {fmt(widthM, 2)}m x {fmt(heightM, 2)}m | x {fmt(Number(ex.x1), 2)} to {fmt(Number(ex.x2), 2)} | z {fmt(Number(ex.z1), 2)} to {fmt(Number(ex.z2), 2)}
                          </div>
                        </div>
                        <button
                          onClick={() => setExclusions((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-700"
                          title="Delete exclusion"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={onNext}
              disabled={busy.rec}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                busy.rec
                  ? "bg-blue-400 text-white cursor-wait"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              {busy.rec ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {busy.rec ? "Generating Recommendation" : "Generate Recommendation"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <PanelView
            L={Number(L)}
            W={Number(W)}
            H={Number(H)}
            recommendation={null}
            exclusions={exclusions}
            source={source}
            listener={listener}
            title="Interactive 3D Room Editor"
            interactive={true}
            editTool={editTool}
            exclusionSize={{ width: exWidth, height: exHeight }}
            onPlaceSource={setSource}
            onPlaceListener={setListener}
            onAddExclusion={(rect) => setExclusions((prev) => [...prev, rect])}
          />
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({
  recommendation,
  rt60,
  audio,
  busy,
  audioInputMode,
  onSelectAudioInputMode,
  uploadedAudioFile,
  onPickUploadedAudio,
  onGenerateAudio,
  onReset,
  L,
  W,
  H,
  source,
  listener,
}) => {
  const panelViewCaptureRef = useRef(null);
  const [exportBusy, setExportBusy] = useState(false);

  if (!recommendation) return null;

  const handleExportReport = async () => {
    setExportBusy(true);

    try {
      let snapshotDataUrl = null;

      try {
        snapshotDataUrl = await panelViewCaptureRef.current?.captureSnapshot?.();
      } catch (snapshotError) {
        console.warn("3D snapshot export failed:", snapshotError);
      }

      const doc = buildPdfReport({
        recommendation,
        rt60,
        audio,
        L,
        W,
        H,
        source,
        listener,
        snapshotDataUrl,
      });

      doc.save(buildReportFilename());
    } catch (error) {
      console.error("report export failed:", error);
      window.alert(error?.message || "Could not export the PDF report.");
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analysis Results</h2>
          <p className="text-slate-500">Optimized plan based on geometry + predicted materials.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            type="button"
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            New Session
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={exportBusy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:cursor-wait disabled:opacity-70"
          >
            {exportBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportBusy ? "Exporting..." : "Export Report"}
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
                <span className="text-slate-500">Delta (before - after)</span>
                <span className="font-semibold text-slate-800">{fmt(rt60?.rt60_delta)}s</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" /> Confirmed Materials
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Wall</span>
                <span className="font-semibold text-slate-800">{recommendation?.materials?.wall ?? "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Floor</span>
                <span className="font-semibold text-slate-800">{recommendation?.materials?.floor ?? "-"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Ceiling</span>
                <span className="font-semibold text-slate-800">{recommendation?.materials?.ceiling ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-600" /> Auralization
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Choose a built-in sample or upload your own dry audio, then generate an untreated-vs-treated preview using the predicted room response.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "sample",
                    title: "Use Built-In Sample",
                    body: "Uses the built-in speech sample plus the clap test.",
                  },
                  {
                    id: "upload",
                    title: "Upload Dry Audio",
                    body: "Bring a clean voice or music file and we will simulate this room on it.",
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelectAudioInputMode(option.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      audioInputMode === option.id
                        ? "border-purple-500 bg-purple-50 text-purple-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{option.body}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Upload mode only accepts a dry recording.
                <div className="mt-1 text-amber-800/90">
                  Use a clean voice or music file. Do not upload audio that was already recorded inside the untreated room.
                </div>
              </div>

              {audioInputMode === "upload" && (
                <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition-colors">
                  <input
                    type="file"
                    accept=".wav,.flac,.ogg,.oga,audio/wav,audio/flac,audio/ogg"
                    onChange={(e) => onPickUploadedAudio(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  {uploadedAudioFile ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{uploadedAudioFile.name}</div>
                      <div className="mt-1 text-xs text-slate-500">Dry WAV, FLAC, or OGG file selected.</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Choose dry audio file</div>
                      <div className="mt-1 text-xs text-slate-500">Supported formats: WAV, FLAC, OGG.</div>
                    </div>
                  )}
                </label>
              )}

              <button
                onClick={onGenerateAudio}
                disabled={busy.audio}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy.audio ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {audioInputMode === "upload" ? "Generate Dry Audio Preview" : "Generate Audio Simulation"}
              </button>

              {audio && (
                <div className="space-y-4 pt-2">
                  <AudioPlayer type="Clap Test" label="Before" src={`http://127.0.0.1:8000${audio.clap_before_audio}`} />
                  <AudioPlayer type="Clap Test" label="After" src={`http://127.0.0.1:8000${audio.clap_after_audio}`} />
                  <div className="border-t border-slate-100 my-2" />
                  <AudioPlayer
                    type={audio.speech_label || "Speech Sample"}
                    label="Before"
                    src={`http://127.0.0.1:8000${audio.speech_before_audio}`}
                  />
                  <AudioPlayer
                    type={audio.speech_label || "Speech Sample"}
                    label="After"
                    src={`http://127.0.0.1:8000${audio.speech_after_audio}`}
                  />
                </div>
              )}
            </div>
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
            source={source}
            listener={listener}
            title="3D Room Viewer"
            captureApiRef={panelViewCaptureRef}
          />

          <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              Blue panels are recommended treatment, red areas are your manual exclusions, and amber source-clearance zones are added automatically only when the source is very close to a wall.
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

  const [L, setL] = useState(5.2);
  const [W, setW] = useState(4.1);
  const [H, setH] = useState(2.8);

  const [imageFile, setImageFile] = useState(null);
  const [imageURL, setImageURL] = useState("");

  const [mode, setMode] = useState(null);
  const [samples, setSamples] = useState({ wall: null, floor: null, ceiling: null });

  const [autoSurfaceResult, setAutoSurfaceResult] = useState(null);
  const [surfaceDetectionTried, setSurfaceDetectionTried] = useState(false);
  const [surfaceDetectionBusy, setSurfaceDetectionBusy] = useState(false);
  const [useManualMaterialFlow, setUseManualMaterialFlow] = useState(false);

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

  const [source, setSource] = useState({ x: 1.3, y: 1.0, z: 1.5 });
  const [listener, setListener] = useState({ x: 2.6, y: 2.05, z: 1.5 });
  const [exclusions, setExclusions] = useState([]);

  const [busy, setBusy] = useState({ suggest: false, rec: false, audio: false });
  const [err, setErr] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [rt60, setRt60] = useState(null);
  const [audio, setAudio] = useState(null);
  const [audioInputMode, setAudioInputMode] = useState("sample");
  const [uploadedAudioFile, setUploadedAudioFile] = useState(null);

  const wall_a = useMemo(() => MATERIALS[override.wall]?.a || 0.07, [override.wall]);
  const floor_a = useMemo(() => MATERIALS[override.floor]?.a || 0.2, [override.floor]);
  const ceil_a = useMemo(() => MATERIALS[override.ceiling]?.a || 0.07, [override.ceiling]);

  const onSelectAudioInputMode = (nextMode) => {
    setAudioInputMode(nextMode);
    setAudio(null);
    setErr("");
  };

  const onPickUploadedAudio = (file) => {
    setUploadedAudioFile(file);
    setAudio(null);
    setErr("");
  };

  const onPickImage = (file) => {
    setImageFile(file);
    setImageURL(URL.createObjectURL(file));

    setMode(null);
    setSamples({ wall: null, floor: null, ceiling: null });

    setAutoSurfaceResult(null);
    setSurfaceDetectionTried(false);
    setSurfaceDetectionBusy(false);
    setUseManualMaterialFlow(false);

    setOverride({ wall: "painted_plaster", floor: "wood", ceiling: "painted_plaster" });
    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });

    setSource({ x: 1.3, y: 1.0, z: 1.5 });
    setListener({ x: 2.6, y: 2.05, z: 1.5 });
    setExclusions([]);

    setRecommendation(null);
    setRt60(null);
    setAudio(null);
    setAudioInputMode("sample");
    setUploadedAudioFile(null);
    setErr("");
  };

  const onClearMaterialSamples = () => {
    setSamples({ wall: null, floor: null, ceiling: null });
    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });
    setUseManualMaterialFlow(true);
    setErr("");
  };

  const surfaceBoxToRect = (surface) => {
    if (!surface?.bbox) return null;
    return {
      x1: Number(surface.bbox.x1),
      y1: Number(surface.bbox.y1),
      x2: Number(surface.bbox.x2),
      y2: Number(surface.bbox.y2),
    };
  };

  const runSurfaceDetection = async () => {
    if (!imageFile) return;

    setErr("");
    setSurfaceDetectionBusy(true);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);

      const result = await api.segmentSurfaces(fd);

      setAutoSurfaceResult(result);
      setSurfaceDetectionTried(true);

      const wallRect = surfaceBoxToRect(result?.surfaces?.wall);
      const floorRect = surfaceBoxToRect(result?.surfaces?.floor);
      const ceilingRect = surfaceBoxToRect(result?.surfaces?.ceiling);

      if (wallRect && floorRect && ceilingRect) {
        setSamples({
          wall: wallRect,
          floor: floorRect,
          ceiling: ceilingRect,
        });
      }

      if (result?.fallback_required) {
        setUseManualMaterialFlow(true);
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e));
      setAutoSurfaceResult(null);
      setSurfaceDetectionTried(true);
      setUseManualMaterialFlow(true);
    } finally {
      setSurfaceDetectionBusy(false);
    }
  };

  useEffect(() => {
    if (step === 2 && imageFile && !surfaceDetectionTried && !surfaceDetectionBusy) {
      runSurfaceDetection();
    }
  }, [step, imageFile, surfaceDetectionTried, surfaceDetectionBusy]);

  const suggestFromManualClick = async (surface) => {
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

  const suggestFromAutoBbox = async (surface) => {
    const rect = samples[surface];
    if (!rect) throw new Error(`No detected ${surface} region available.`);

    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("surface", surface);
    fd.append("x1", String(rect.x1));
    fd.append("y1", String(rect.y1));
    fd.append("x2", String(rect.x2));
    fd.append("y2", String(rect.y2));

    return await api.suggestMaterialFromBbox(fd);
  };

  const onSuggestMaterials = async () => {
    setErr("");
    setBusy((b) => ({ ...b, suggest: true }));

    try {
      const runForSurface = async (surface) => {
        if (useManualMaterialFlow) {
          return await suggestFromManualClick(surface);
        }
        return await suggestFromAutoBbox(surface);
      };

      const wallRes = await runForSurface("wall");
      const floorRes = await runForSurface("floor");
      const ceilRes = await runForSurface("ceiling");

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

  useEffect(() => {
    const canAutoSuggest =
      step === 2 &&
      !useManualMaterialFlow &&
      samples.wall &&
      samples.floor &&
      samples.ceiling &&
      !busy.suggest &&
      !hasSuggested;

    if (!canAutoSuggest) return;

    onSuggestMaterials();
  }, [
    step,
    useManualMaterialFlow,
    samples.wall,
    samples.floor,
    samples.ceiling,
    busy.suggest,
    hasSuggested,
  ]);

  const onRecommendPanels = async () => {
    setErr("");
    setBusy((b) => ({ ...b, rec: true }));

    try {
      const payload = {
        L: Number(L),
        W: Number(W),
        H: Number(H),
        wall_a: Number(wall_a),
        floor_a: Number(floor_a),
        ceil_a: Number(ceil_a),
        src_x: Number(source.x),
        src_y: Number(source.y),
        src_z: Number(source.z),
        mic_x: Number(listener.x),
        mic_y: Number(listener.y),
        mic_z: Number(listener.z),
        target_coverage: 0.5,
        exclusions: exclusions,
      };

      const res = await api.recommendPanels(payload);
      const enriched = {
        ...res,
        materials: {
          wall: MATERIALS[override.wall]?.label ?? override.wall,
          floor: MATERIALS[override.floor]?.label ?? override.floor,
          ceiling: MATERIALS[override.ceiling]?.label ?? override.ceiling,
        },
      };
      setRecommendation(enriched);
      setAudio(null);

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

      setStep(4);
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
        src_x: Number(source.x),
        src_y: Number(source.y),
        src_z: Number(source.z),
        mic_x: Number(listener.x),
        mic_y: Number(listener.y),
        mic_z: Number(listener.z),
      };

      let res;
      if (audioInputMode === "upload") {
        if (!uploadedAudioFile) {
          throw new Error("Upload a dry WAV, FLAC, or OGG file first.");
        }

        const fd = new FormData();
        fd.append("payload", JSON.stringify(payload));
        fd.append("audio_file", uploadedAudioFile);
        res = await api.generateAudioUpload(fd);
      } else {
        res = await api.generateAudio(payload);
      }

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
    setOverride({ wall: "painted_plaster", floor: "wood", ceiling: "painted_plaster" });
    setSuggested({ wall: null, floor: null, ceiling: null });
    setHasSuggested(false);
    setMaterialCandidates({ wall: null, floor: null, ceiling: null });

    setSource({ x: 1.3, y: 1.0, z: 1.5 });
    setListener({ x: 2.6, y: 2.05, z: 1.5 });
    setExclusions([]);

    setRecommendation(null);
    setRt60(null);
    setAudio(null);
    setAudioInputMode("sample");
    setUploadedAudioFile(null);
    setErr("");

    setL(5.2);
    setW(4.1);
    setH(2.8);

    setAutoSurfaceResult(null);
    setSurfaceDetectionTried(false);
    setSurfaceDetectionBusy(false);
    setUseManualMaterialFlow(false);
    setMode(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <Header />

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <>
                {step > 0 && <StepProgress step={step} />}

                {step === 0 && <Hero onStart={() => setStep(1)} />}

                {step === 1 && (
                  <InputStep
                    L={L}
                    setL={setL}
                    W={W}
                    setW={setW}
                    H={H}
                    setH={setH}
                    imageFile={imageFile}
                    onPickImage={onPickImage}
                    onNext={() => setStep(2)}
                  />
                )}

                {step === 2 && (
                  <MaterialStep
                    imageURL={imageURL}
                    mode={mode}
                    setMode={setMode}
                    samples={samples}
                    setSamples={setSamples}
                    override={override}
                    setOverride={setOverride}
                    suggested={suggested}
                    hasSuggested={hasSuggested}
                    materialCandidates={materialCandidates}
                    onSuggestMaterials={onSuggestMaterials}
                    busy={{ ...busy, surfaceDetection: surfaceDetectionBusy }}
                    err={err}
                    onClearAll={onClearMaterialSamples}
                    onNext={() => setStep(3)}
                    autoSurfaceResult={autoSurfaceResult}
                    surfaceDetectionBusy={surfaceDetectionBusy}
                    useManualMaterialFlow={useManualMaterialFlow}
                    setUseManualMaterialFlow={setUseManualMaterialFlow}
                  />
                )}

                {step === 3 && (
                  <EditorStep
                    L={L}
                    W={W}
                    H={H}
                    source={source}
                    setSource={setSource}
                    listener={listener}
                    setListener={setListener}
                    exclusions={exclusions}
                    setExclusions={setExclusions}
                    busy={busy}
                    onBack={() => setStep(2)}
                    onNext={onRecommendPanels}
                  />
                )}

                {step === 4 && (
                  <Dashboard
                    recommendation={recommendation}
                    rt60={rt60}
                    audio={audio}
                    busy={busy}
                    audioInputMode={audioInputMode}
                    onSelectAudioInputMode={onSelectAudioInputMode}
                    uploadedAudioFile={uploadedAudioFile}
                    onPickUploadedAudio={onPickUploadedAudio}
                    onGenerateAudio={onGenerateAudio}
                    onReset={handleReset}
                    source={source}
                    listener={listener}
                    L={L}
                    W={W}
                    H={H}
                  />
                )}
              </>
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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








