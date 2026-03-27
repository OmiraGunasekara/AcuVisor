import React from "react";
import { Check } from "lucide-react";
import { FLOW_STEPS } from "../../constants";

export const StepProgress = ({ step }) => {
  const activeStep = Math.min(Math.max(step, 1), FLOW_STEPS.length);
  const lineInset = FLOW_STEPS.length > 1 ? 100 / (FLOW_STEPS.length * 2) : 0;
  const lineWidth = 100 - lineInset * 2;
  const connectorProgress =
    FLOW_STEPS.length > 1 ? ((activeStep - 1) / (FLOW_STEPS.length - 1)) * lineWidth : lineWidth;
  const contentWidthClass = activeStep <= 2 ? "max-w-4xl" : "max-w-7xl";

  return (
    <div className={`${contentWidthClass} mx-auto px-4 pt-8 pb-2`}>
      <div className="relative grid grid-cols-4 gap-2">
        <div
          className="pointer-events-none absolute top-5 h-[3px] rounded-full bg-slate-200"
          style={{ left: `${lineInset}%`, width: `${lineWidth}%` }}
        />
        <div
          className="pointer-events-none absolute top-5 h-[3px] rounded-full bg-blue-500 transition-all duration-500"
          style={{ left: `${lineInset}%`, width: `${connectorProgress}%` }}
        />

        {FLOW_STEPS.map((flowStep) => {
          const isDone = flowStep.id < activeStep;
          const isActive = flowStep.id === activeStep;

          return (
            <div key={flowStep.id} className="relative z-10 flex flex-col items-center text-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                  isActive
                    ? "border-blue-500 bg-blue-500 text-white ring-4 ring-blue-100"
                    : isDone
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-blue-500 bg-white text-blue-500"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : flowStep.id}
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${isActive ? "text-slate-900" : "text-slate-600"}`}>
                {flowStep.label}
              </div>
              <div className="hidden text-[10px] text-slate-400 sm:block">{flowStep.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
