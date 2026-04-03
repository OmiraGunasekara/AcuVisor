import React from "react";
import { ArrowRight } from "lucide-react";

// Landing Page
export const Hero = ({ onStart }) => (
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
