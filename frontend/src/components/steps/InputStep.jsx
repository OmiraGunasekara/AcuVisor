import React from "react";
import { Upload, Maximize, CheckCircle } from "lucide-react";

// Configuration UI for setting room dimensions and uploading a photo
export const InputStep = ({ L, setL, W, setW, H, setH, onPickImage, imageFile, onNext }) => {
  // Catch files dragged and dropped onto the upload zone
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onPickImage(e.dataTransfer.files[0]);
    }
  };

  // Catch standard click-to-upload file selections
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
