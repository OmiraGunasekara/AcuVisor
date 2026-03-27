import React, { useRef, useState } from "react";
import { RefreshCw, PenTool, Eraser, Wand2, Layers } from "lucide-react";
import { MATERIALS } from "../../constants";
import { clamp01, fmt } from "../../utils/math";

export const MaterialStep = ({
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
                      <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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
