import React, { useState, useRef } from "react";
import PanelView from "../PanelView";
import { AudioPlayer } from "../ui/AudioPlayer";
import { RefreshCw, Download, BarChart3, Info, Volume2, Box, Play } from "lucide-react";
import { fmt } from "../../utils/math";
import { buildPdfReport, buildReportFilename } from "../../utils/report";
import { apiUrl } from "../../api";

// Final step showing acoustic results, reports, and audio simulation
export const Dashboard = ({
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

  // Captures the 3D canvas and generates a PDF report
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
          <p className="text-slate-500">Optimized plan based on geometry & predicted materials.</p>
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
                  <AudioPlayer type="Clap Test" label="Before" src={apiUrl(audio.clap_before_audio)} />
                  <AudioPlayer type="Clap Test" label="After" src={apiUrl(audio.clap_after_audio)} />
                  <div className="border-t border-slate-100 my-2" />
                  <AudioPlayer
                    type={audio.speech_label || "Speech Sample"}
                    label="Before"
                    src={apiUrl(audio.speech_before_audio)}
                  />
                  <AudioPlayer
                    type={audio.speech_label || "Speech Sample"}
                    label="After"
                    src={apiUrl(audio.speech_after_audio)}
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


