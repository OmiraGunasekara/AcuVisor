import React from "react";
import { ArrowRight, Box, Info, Upload, Volume2, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

const capabilityCards = [
  {
    icon: Upload,
    title: "Photo + Geometry Input",
    body:
      "AcuVisor starts with the practical information people actually have: room dimensions, a room photo, and a rough listening layout.",
  },
  {
    icon: Wand2,
    title: "Material Guidance",
    body:
      "The app helps estimate wall, floor, and ceiling materials so the acoustic model starts from something realistic instead of a blank template.",
  },
  {
    icon: Box,
    title: "3D Treatment Planning",
    body:
      "Source, listener, exclusions, and suggested acoustic panels are shown in a room viewer so the recommendation is easier to understand and trust.",
  },
  {
    icon: Volume2,
    title: "Results You Can Hear",
    body:
      "Beyond metrics, AcuVisor can produce untreated-versus-treated audio previews and export a shareable PDF report for review.",
  },
];

const principles = [
  "Make acoustic treatment easier to understand before anyone buys hardware or starts mounting panels.",
  "Translate technical modeling into a workflow that feels approachable for studios, creators, and small-room setups.",
  "Keep recommendations visual, explainable, and grounded in room dimensions, layout, and material assumptions.",
];

export default function AboutPage() {
  return (
    <div className="px-4 py-10 md:py-14 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-10">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white shadow-xl shadow-slate-900/10">
          <div className="grid gap-10 px-6 py-10 md:grid-cols-[1.2fr,0.8fr] md:px-10 md:py-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                <Info className="h-4 w-4" />
                About AcuVisor
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
                Acoustic planning that is meant to feel practical, not mysterious.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                AcuVisor is an acoustic treatment planning app for small rooms. It helps turn room photos,
                materials, geometry, and listening positions into a treatment recommendation you can inspect in
                3D, review with metrics, preview with audio, and export as a report.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  Start Analyzing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  See The Workflow
                </Link>
              </div>
            </div>

            <div className="grid gap-4 self-start rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">What It Is</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  A guided workflow for planning acoustic treatment in compact studios, editing rooms, listening
                  setups, and creator spaces.
                </p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">What It Is Not</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Not a replacement for a full on-site acoustic consultation or detailed measurement campaign in a
                  complex professional facility.
                </p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Best Use</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Early design decisions, treatment planning, clearer communication, and faster iteration before
                  final implementation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {capabilityCards.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Why It Exists</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">Acoustic choices are easier when you can see the tradeoffs.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Many small-room users know their space has issues but struggle to translate that into a treatment plan.
              AcuVisor is meant to bridge that gap with a workflow that moves from room understanding to material
              assumptions to visible panel placement and outcome review.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Core Principles</div>
            <div className="mt-5 space-y-4">
              {principles.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
