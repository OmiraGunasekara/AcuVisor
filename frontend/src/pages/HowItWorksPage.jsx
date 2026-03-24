import React from "react";
import { ArrowRight, BarChart3, Box, Upload, Volume2, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Upload,
    eyebrow: "Step 1",
    title: "Set up the room",
    body:
      "Enter room dimensions and upload a reference photo. This gives the app the physical scale and the image context it needs to begin.",
  },
  {
    icon: Wand2,
    eyebrow: "Step 2",
    title: "Confirm material assumptions",
    body:
      "AcuVisor suggests likely wall, floor, and ceiling materials from the image flow. You can review and override those choices before continuing.",
  },
  {
    icon: Box,
    eyebrow: "Step 3",
    title: "Lay out the room in 3D",
    body:
      "Place the source and listener, add exclusions where treatment cannot go, and inspect the room model from multiple views before generating the recommendation.",
  },
  {
    icon: BarChart3,
    eyebrow: "Step 4",
    title: "Review the results",
    body:
      "The app shows recommended treatment, predicted RT60 improvement, the room view, and a PDF export. Audio previews can also be generated to compare before and after.",
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
    <div className="px-4 py-10 md:py-14 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-10">
        <section className="rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-100 p-6 shadow-sm md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
              <Wand2 className="h-4 w-4" />
              How It Works
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              A guided workflow from room photo to treatment plan.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              The app is designed to move in a clear sequence: define the room, estimate materials, place the
              important listening points, then review a recommendation that is easier to visualize and share.
            </p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {steps.map(({ icon: Icon, eyebrow, title, body }) => (
            <article key={title} className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">{eyebrow}</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr,0.9fr]">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">What You Get</div>
            <div className="mt-5 space-y-3">
              {outputs.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-slate-900 p-7 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Important Context</div>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              The recommendation quality depends on the accuracy of your room dimensions, material choices, and
              placement inputs. Treat the output as a strong planning guide, then refine with listening tests or
              measurement if you are moving toward a final professional installation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                Open The Analyzer
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                About AcuVisor
              </Link>
            </div>
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-7 text-amber-900 shadow-sm">
          Audio previews and treatment suggestions are meant to help decision-making early. They are most useful as
          a guided design tool, especially before installing panels or committing to a treatment layout.
        </section>
      </div>
    </div>
  );
}
