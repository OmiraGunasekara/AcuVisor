import React, { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// Reusable audio playback component for previewing simulations
export const AudioPlayer = ({ type, label, src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Handles safe toggle for audio playback
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
