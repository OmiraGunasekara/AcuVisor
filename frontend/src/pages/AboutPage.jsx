import React from "react";
import { ArrowRight, Box, Info, Upload, Volume2, Wand2, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const capabilityCards = [
  {
    icon: Upload,
    title: "Photo + Geometry Input",
    body: "AcuVisor starts with the practical information people actually have: room dimensions, a room photo, and a rough listening layout.",
    color: "blue"
  },
  {
    icon: Wand2,
    title: "Material Guidance",
    body: "The app helps estimate wall, floor, and ceiling materials so the acoustic model starts from something realistic instead of a blank template.",
    color: "purple"
  },
  {
    icon: Box,
    title: "3D Treatment Planning",
    body: "Source, listener, exclusions, and suggested acoustic panels are shown in a room viewer so the recommendation is easier to understand and trust.",
    color: "emerald"
  },
  {
    icon: Volume2,
    title: "Results You Can Hear",
    body: "Beyond metrics, AcuVisor can produce untreated-versus-treated audio previews and export a shareable PDF report for review.",
    color: "amber"
  },
];

const principles = [
  "Make acoustic treatment easier to understand before anyone buys hardware or starts mounting panels.",
  "Translate technical modeling into a workflow that feels approachable for studios, creators, and small-room setups.",
  "Keep recommendations visual, explainable, and grounded in room dimensions, layout, and material assumptions.",
];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 pb-20 overflow-hidden selection:bg-blue-200 selection:text-blue-900 animate-fade-in font-sans">
      {/* Glowing background meshes */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-40">
        <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-300 mix-blend-multiply blur-[128px]" />
        <div className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-200 mix-blend-multiply blur-[128px]" />
        <div className="absolute bottom-[-10%] left-[20%] h-[600px] w-[600px] rounded-full bg-violet-200 mix-blend-multiply blur-[128px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-12 md:pt-16 lg:px-8 space-y-12 md:space-y-20">
        {/* Premium Hero Section */}
        <section className="group relative overflow-hidden rounded-[2.5rem] bg-slate-900 px-6 py-10 shadow-2xl md:px-10 md:py-16 border border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black opacity-80" />
          
          <div className="relative z-10 grid gap-12 lg:grid-cols-[1.2fr,0.8fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300 backdrop-blur-md">
                <Info className="h-4 w-4" />
                About AcuVisor
              </div>
              <h1 className="mt-6 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 pb-2">
                Acoustic planning that is meant to feel practical, not mysterious.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                AcuVisor is an acoustic treatment planning app for small rooms. It helps turn room photos,
                materials, geometry, and listening positions into a treatment recommendation you can inspect in
                3D, review with metrics, preview with audio, and export as a report.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/?start=true"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-1 hover:bg-blue-500 hover:shadow-blue-500/30"
                >
                  Start Analyzing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-white/10"
                >
                  See The Workflow
                </Link>
              </div>
            </div>

            <div className="relative lg:justify-self-end w-full max-w-sm">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-blue-500/20 to-purple-500/20 blur-xl opacity-50 group-hover:opacity-100 transition duration-700 pointer-events-none" />
              <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-lg">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400">What It Is</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      A guided workflow for planning acoustic treatment in compact studios, editing rooms, listening
                      setups, and creator spaces.
                    </p>
                  </div>
                  <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400">What It Is Not</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      Not a replacement for a full on-site acoustic consultation or detailed measurement campaign in a
                      complex professional facility.
                    </p>
                  </div>
                  <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Best Use</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      Early design decisions, treatment planning, clearer communication, and faster iteration before
                      final implementation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Capabilities Grid */}
        <section>
          <div className="mb-12 text-center relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Powerful tools, simply presented.
            </h2>
            <p className="mt-4 text-lg text-slate-600">Everything you need to predict your room's sound, in one workflow.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
            {capabilityCards.map(({ icon: Icon, title, body, color }) => {
              const colorMaps = {
                blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white border-blue-200",
                purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white border-purple-200",
                emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white border-emerald-200",
                amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white border-amber-200",
              };
              
              return (
                <article 
                  key={title} 
                  className="group relative flex flex-col rounded-[2rem] border border-slate-200/60 bg-white/60 p-8 backdrop-blur-xl shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:bg-white"
                >
                  <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors duration-300 ${colorMaps[color]}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 flex-grow">{body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Mission / Principles */}
        <section className="grid gap-8 lg:grid-cols-[1fr,1fr] xl:gap-16 relative z-10">
          <div className="relative group">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-blue-100 to-purple-100 blur-2xl opacity-50 group-hover:opacity-100 transition duration-500 pointer-events-none" />
            <div className="relative h-full rounded-[2.5rem] border border-white/40 bg-white/80 p-10 backdrop-blur-xl shadow-xl shadow-slate-200/50">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-600 mb-6 border border-blue-100">
                Why It Exists
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl mb-4 leading-tight">
                Acoustic choices are easier when you can see the tradeoffs.
              </h2>
              <p className="text-base leading-relaxed text-slate-600 mb-6">
                Many small-room users know their space has issues but struggle to translate that into a treatment plan.
                AcuVisor is meant to bridge that gap with a workflow that moves from room understanding to material
                assumptions to visible panel placement and outcome review.
              </p>
            </div>
          </div>

          <div className="relative h-full rounded-[2.5rem] border border-slate-200/60 bg-white/80 backdrop-blur-xl p-10 shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-600 mb-8 border border-slate-200">
              Core Principles
            </div>
            <div className="space-y-6">
              {principles.map((item, idx) => (
                <div key={idx} className="group flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors mt-0.5 shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-base leading-relaxed text-slate-700 font-medium">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
