import React, { useState, useMemo, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";

import { MATERIALS } from "./constants";
import { normalizeLabel } from "./utils/math";

import { Header } from "./components/ui/Header";
import { StepProgress } from "./components/ui/StepProgress";

import { Hero } from "./components/steps/Hero";
import { InputStep } from "./components/steps/InputStep";
import { MaterialStep } from "./components/steps/MaterialStep";
import { EditorStep } from "./components/steps/EditorStep";
import { Dashboard } from "./components/steps/Dashboard";

import AboutPage from "./pages/AboutPage";
import HowItWorksPage from "./pages/HowItWorksPage";

export default function App() {
  const location = useLocation();
  const [step, setStep] = useState(() => new URLSearchParams(window.location.search).get("start") === "true" ? 1 : 0);

  useEffect(() => {
    if (location.pathname === "/" && new URLSearchParams(location.search).get("start") === "true") {
      setStep(1);
    }
  }, [location.pathname, location.search]);

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
      <Header onHomeClick={handleReset} />

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

