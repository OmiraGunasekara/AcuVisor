import React, { useState } from "react";
import PanelView from "../PanelView";
import { Trash2, RefreshCw } from "lucide-react";
import { fmt } from "../../utils/math";

export const EditorStep = ({
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
          <div className="text-xs text-slate-500">X = Length, Y = Width, Z = Height. Click the floor to set (X,Y) and walls for height (Z).</div>
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
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">3D Room Editor</h2>
            <p className="text-slate-500 text-sm">
              Your 3D room is generated using the specified dimensions. Click around the room to position your sound source and listener.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">Placement Tools</h3>
              <p className="mt-1 text-sm text-slate-500">
                Select a tool below, then click on the floor to set horizontal positions (X/Y) or on side walls to adjust height. Use the coordinate inputs for precise adjustments. Add exclusion zones (like doors or windows) by clicking on any wall.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setEditTool("source")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${editTool === "source"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
              >
                Place Source
              </button>
              <button
                onClick={() => setEditTool("listener")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${editTool === "listener"
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
              >
                Place Listener
              </button>
              <button
                onClick={() => setEditTool("exclusion")}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${editTool === "exclusion"
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
                  Hover over any wall in the 3D room to position the exclusion zone, then click to lock it in place.
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
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${busy.rec
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
