import React from "react";
import { ArrowRight, BarChart3, Box, Upload, Volume2, Wand2, Info } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Upload,
    eyebrow: "01",
    title: "Set up the room",
    body: "Enter room dimensions and upload a reference photo. This gives the app the physical scale and the image context it needs to begin.",
    color: "blue"
  },
  {
    icon: Wand2,
    eyebrow: "02",
    title: "Confirm materials",
    body: "AcuVisor suggests likely wall, floor, and ceiling materials from the image flow. You can review and override those choices before continuing.",
    color: "purple"
  },
  {
    icon: Box,
    eyebrow: "03",
    title: "Lay out in 3D",
    body: "Place the source and listener, add exclusions where treatment cannot go, and inspect the room model from multiple views before generating the recommendation.",
    color: "emerald"
  },
  {
    icon: BarChart3,
    eyebrow: "04",
    title: "Review results",
    body: "The app shows recommended treatment, predicted RT60 improvement, the room view, and a PDF export. Audio previews can also be generated to compare before and after.",
    color: "amber"
  },
];

const outputs = [
  "Recommended panel placement in the 3D room viewer",
  "Predicted acoustic metrics including before/after RT60",
  "Material summary for wall, floor, and ceiling assumptions",
  "Audio preview workflow for untreated vs treated listening",
  "Exportable PDF report for sharing or documentation",
];

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 pb-20 overflow-hidden selection:bg-blue-200 selection:text-blue-900 animate-fade-in font-sans">
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 pointer-events-none">
        <svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.03] text-slate-900">
          <circle cx="400" cy="400" r="399" stroke="currentColor" strokeWidth="2"/>
          <circle cx="400" cy="400" r="299" stroke="currentColor" strokeWidth="2"/>
          <circle cx="400" cy="400" r="199" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>
      <div className="absolute top-40 left-0 -translate-x-1/2 pointer-events-none">
        <svg width="600" height="600" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.03] text-slate-900">
          <circle cx="300" cy="300" r="299" stroke="currentColor" strokeWidth="2"/>
          <circle cx="300" cy="300" r="199" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-16 md:pt-24 lg:px-8 space-y-24">
        <section className="relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 mb-8 backdrop-blur-sm shadow-sm">
            <Wand2 className="h-4 w-4" />
            How It Works
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl mb-4 leading-[1.1]">
            A guided workflow from room photo to treatment plan.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            The app is designed to move in a clear sequence: define the room, estimate materials, place the
            important listening points, then review a recommendation that is easier to visualize and share.
          </p>
        </section>

        <section className="relative max-w-5xl mx-auto">
          <div className="absolute hidden md:block top-[110px] left-0 right-0 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent z-0" />
          
          <div className="grid gap-8 md:grid-cols-4 relative z-10">
            {steps.map(({ icon: Icon, eyebrow, title, body, color }) => {
              const colorMaps = {
                blue: "from-blue-500 to-indigo-500 shadow-blue-500/30",
                purple: "from-purple-500 to-fuchsia-500 shadow-purple-500/30",
                emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
                amber: "from-amber-500 to-orange-500 shadow-amber-500/30",
              };

              return (
                <article key={title} className="group relative pt-4">
                  <div className="h-full rounded-[2rem] border border-white/60 bg-white/60 p-8 backdrop-blur-xl shadow-xl shadow-slate-200/50 transition duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-2xl flex flex-col items-center text-center">
                    <div className={`mb-6 flex h-16 w-16 -mt-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-br ${colorMaps[color]} text-white shadow-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="text-4xl font-black text-slate-100 group-hover:text-slate-200 transition-colors mb-2 -mt-4 uppercase tracking-tighter">
                      {eyebrow}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
                    <p className="text-sm leading-relaxed text-slate-600 flex-grow">
                      {body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <article className="relative rounded-[2.5rem] border border-slate-200/80 bg-white/80 backdrop-blur-md p-10 shadow-xl shadow-slate-200/40">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-600">
              What You Get
            </div>
            <div className="space-y-4">
              {outputs.map((item, i) => (
                <div key={i} className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition duration-300 hover:border-blue-200 hover:bg-blue-50/80 hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-500 shadow-sm border border-slate-100 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <span className="text-[15px] font-medium text-slate-700 leading-snug group-hover:text-slate-900">{item}</span>
                </div>
              ))}
            </div>
          </article>

          <div className="flex flex-col gap-6">
            <article className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl flex-grow border border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black opacity-80" />
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px] z-0 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full">
                <div>
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-300 backdrop-blur-md">
                    <Info className="h-4 w-4" />
                    Important Context
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">Trust, but verify with reality.</h3>
                  <p className="text-base leading-relaxed text-slate-300 mb-8">
                    The recommendation quality depends on the accuracy of your room dimensions, material choices, and
                    placement inputs. Treat the output as a strong planning guide, then refine with listening tests or
                    measurement if you are moving toward a final professional installation.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-4 mt-auto">
                  <Link
                    to="/?start=true"
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-blue-500 hover:shadow-blue-500/30"
                  >
                    Open The Analyzer
                  </Link>
                  <Link
                    to="/about"
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/10"
                  >
                    About AcuVisor
                  </Link>
                </div>
              </div>
            </article>

            <div className="rounded-[2rem] border border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 p-6 text-sm leading-relaxed text-amber-900 shadow-md flex items-start gap-4 hover:shadow-lg transition-shadow">
              <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-amber-100/80 text-amber-600 mt-1">
                <Volume2 className="h-5 w-5" />
              </div>
              <p>
                <b>Audio previews</b> and treatment suggestions are meant to help decision-making early. They are most useful as
                a guided design tool, especially before installing panels or committing to a layout.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
